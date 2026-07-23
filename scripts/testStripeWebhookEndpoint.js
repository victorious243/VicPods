require('dotenv').config();

const crypto = require('crypto');

function getWebhookUrl() {
  if (process.env.STRIPE_WEBHOOK_URL) {
    return String(process.env.STRIPE_WEBHOOK_URL).trim();
  }

  const appUrl = new URL(String(process.env.APP_URL || '').trim());
  appUrl.hostname = appUrl.hostname.replace(/^www\./, '');
  appUrl.pathname = '/webhooks/stripe';
  appUrl.search = '';
  appUrl.hash = '';
  return appUrl.toString();
}

async function main() {
  if (!process.argv.includes('--send')) {
    throw new Error('Pass --send to create one harmless webhook health-check event.');
  }

  const webhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret.startsWith('whsec_')) {
    throw new Error('STRIPE_WEBHOOK_SECRET is missing or invalid.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const event = {
    id: `evt_vicpods_healthcheck_${Date.now()}`,
    object: 'event',
    api_version: '2025-09-30.clover',
    created: timestamp,
    data: {
      object: {
        id: 'vicpods_billing_healthcheck',
        object: 'vicpods.billing.healthcheck',
      },
    },
    livemode: true,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type: 'vicpods.billing.healthcheck',
  };
  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const response = await fetch(getWebhookUrl(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`,
      'user-agent': 'VicPods-Stripe-Healthcheck/1.0',
    },
    body,
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 300)}`);
  }

  const result = JSON.parse(responseBody);
  if (result.received !== true) {
    throw new Error('VicPods did not confirm receipt of the signed webhook.');
  }

  console.log(`Signed webhook health check accepted (HTTP ${response.status}, event ${event.id}).`);
}

main().catch((error) => {
  console.error(
    'Stripe webhook delivery check failed. The signing secret in this environment was not accepted '
    + `by the deployed endpoint: ${error.message}`
  );
  process.exitCode = 1;
});
