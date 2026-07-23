const crypto = require('crypto');
const { IntegrationConnection } = require('../../models/IntegrationConnection');
const WebhookDelivery = require('../../models/WebhookDelivery');

let workerHandle = null;
let workerRunning = false;

function computeRetryDelayMs(attemptCount) {
  const normalizedAttempt = Math.max(1, Number(attemptCount) || 1);
  return Math.min(60 * 60 * 1000, (2 ** Math.min(normalizedAttempt, 6)) * 30 * 1000);
}

function signPayload(secret, payloadText) {
  if (!secret) {
    return '';
  }

  return crypto
    .createHmac('sha256', String(secret))
    .update(String(payloadText || ''))
    .digest('hex');
}

function normalizeResponsePreview(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000);
}

async function claimNextWebhookDelivery(now = new Date()) {
  return WebhookDelivery.findOneAndUpdate(
    {
      status: { $in: ['queued', 'retrying'] },
      nextAttemptAt: { $lte: now },
    },
    {
      $set: {
        status: 'processing',
        lastAttemptAt: now,
      },
      $inc: {
        attemptCount: 1,
      },
    },
    {
      new: true,
      sort: { nextAttemptAt: 1, createdAt: 1 },
    }
  );
}

async function appendAttemptLog(delivery, entry) {
  const nextLog = Array.isArray(delivery.attemptLog) ? delivery.attemptLog.slice(-9) : [];
  nextLog.push(entry);
  delivery.attemptLog = nextLog;
}

async function markDeliveryDelivered({ delivery, connection, responseCode, responseBodyPreview, now = new Date() }) {
  delivery.status = 'delivered';
  delivery.deliveredAt = now;
  delivery.nextAttemptAt = now;
  delivery.responseCode = responseCode;
  delivery.responseBodyPreview = responseBodyPreview;
  delivery.errorMessage = '';
  appendAttemptLog(delivery, {
    attemptedAt: now,
    status: 'delivered',
    responseCode,
    detail: responseBodyPreview || 'Delivered successfully.',
  });
  await delivery.save();

  if (connection) {
    connection.lastUsedAt = now;
    connection.lastDeliveryAt = now;
    connection.lastDeliveryStatus = 'delivered';
    await connection.save();
  }
}

async function markDeliveryRetrying({ delivery, connection, responseCode = null, detail = '', now = new Date() }) {
  const retryDelayMs = computeRetryDelayMs(delivery.attemptCount);
  delivery.status = delivery.attemptCount >= delivery.maxAttempts ? 'failed' : 'retrying';
  delivery.nextAttemptAt = new Date(now.getTime() + retryDelayMs);
  delivery.responseCode = responseCode;
  delivery.errorMessage = detail;
  delivery.responseBodyPreview = normalizeResponsePreview(detail);
  appendAttemptLog(delivery, {
    attemptedAt: now,
    status: delivery.status,
    responseCode,
    detail,
  });
  await delivery.save();

  if (connection) {
    connection.lastUsedAt = now;
    connection.lastDeliveryAt = now;
    connection.lastDeliveryStatus = delivery.status === 'failed' ? 'failed' : 'queued';
    await connection.save();
  }
}

async function processWebhookDelivery(delivery, { fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const connection = delivery.integrationId
    ? await IntegrationConnection.findById(delivery.integrationId)
    : null;

  if (!delivery.targetUrl || typeof fetchImpl !== 'function') {
    delivery.status = 'skipped';
    delivery.errorMessage = delivery.targetUrl ? 'Fetch is unavailable.' : 'Missing target URL.';
    appendAttemptLog(delivery, {
      attemptedAt: now,
      status: 'skipped',
      detail: delivery.errorMessage,
    });
    await delivery.save();
    return { deliveryId: String(delivery._id), status: 'skipped' };
  }

  const payload = delivery.payload && typeof delivery.payload === 'object'
    ? delivery.payload
    : {};
  const payloadText = JSON.stringify(payload);
  const signature = signPayload(connection?.signingSecret, payloadText);

  try {
    const response = await fetchImpl(delivery.targetUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'VicPods-Webhooks/1.0',
        'x-vicpods-event': delivery.eventType,
        'x-vicpods-delivery-id': String(delivery._id),
        ...(signature ? { 'x-vicpods-signature': signature } : {}),
      },
      body: payloadText,
    });

    const responseText = normalizeResponsePreview(await response.text());
    if (response.ok) {
      await markDeliveryDelivered({
        delivery,
        connection,
        responseCode: response.status,
        responseBodyPreview: responseText,
        now,
      });
      return { deliveryId: String(delivery._id), status: 'delivered' };
    }

    await markDeliveryRetrying({
      delivery,
      connection,
      responseCode: response.status,
      detail: responseText || `HTTP ${response.status}`,
      now,
    });
    return { deliveryId: String(delivery._id), status: delivery.status };
  } catch (error) {
    await markDeliveryRetrying({
      delivery,
      connection,
      detail: error.message || 'Webhook delivery failed.',
      now,
    });
    return { deliveryId: String(delivery._id), status: delivery.status };
  }
}

async function processQueuedWebhookDeliveries({ limit = 5, logger = console, fetchImpl = globalThis.fetch } = {}) {
  const summary = {
    claimed: 0,
    delivered: 0,
    failed: 0,
    retrying: 0,
    skipped: 0,
  };

  for (let index = 0; index < Math.max(1, limit); index += 1) {
    const delivery = await claimNextWebhookDelivery();
    if (!delivery) {
      break;
    }

    summary.claimed += 1;
    const result = await processWebhookDelivery(delivery, { fetchImpl });
    if (result.status === 'delivered') {
      summary.delivered += 1;
    } else if (result.status === 'retrying') {
      summary.retrying += 1;
    } else if (result.status === 'failed') {
      summary.failed += 1;
    } else {
      summary.skipped += 1;
    }
  }

  if (summary.failed > 0) {
    logger.error(`VicPods webhook worker recorded ${summary.failed} failed delivery attempt(s).`);
  }

  return summary;
}

async function retryWebhookDelivery({ userId, deliveryId }) {
  const delivery = await WebhookDelivery.findOne({
    _id: deliveryId,
    userId,
  });

  if (!delivery) {
    return null;
  }

  delivery.status = 'queued';
  delivery.nextAttemptAt = new Date();
  delivery.errorMessage = '';
  await delivery.save();
  return delivery;
}

function kickWebhookDeliveryWorker(logger = console) {
  setImmediate(() => {
    processQueuedWebhookDeliveries({ limit: 1, logger }).catch((error) => {
      logger.error('VicPods webhook delivery kick failed: ' + error.message);
    });
  });
}

function startWebhookDeliveryWorker({ intervalMs = 30 * 1000, logger = console } = {}) {
  if (workerHandle || process.env.WEBHOOK_DELIVERY_WORKER_DISABLED === 'true') {
    return workerHandle;
  }

  workerHandle = setInterval(async () => {
    if (workerRunning) {
      return;
    }

    workerRunning = true;
    try {
      await processQueuedWebhookDeliveries({ logger });
    } catch (error) {
      logger.error('VicPods webhook delivery worker failed: ' + error.message);
    } finally {
      workerRunning = false;
    }
  }, Math.max(15 * 1000, intervalMs));

  if (typeof workerHandle.unref === 'function') {
    workerHandle.unref();
  }

  kickWebhookDeliveryWorker(logger);
  return workerHandle;
}

function stopWebhookDeliveryWorker() {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}

module.exports = {
  claimNextWebhookDelivery,
  computeRetryDelayMs,
  kickWebhookDeliveryWorker,
  processQueuedWebhookDeliveries,
  processWebhookDelivery,
  retryWebhookDelivery,
  startWebhookDeliveryWorker,
  stopWebhookDeliveryWorker,
};
