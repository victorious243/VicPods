const User = require('../../models/User');
const PodcastShow = require('../../models/PodcastShow');
const { sendPodcastPerformanceEmail } = require('../email/podcastPerformanceEmailService');
const { queueWebhookDeliveries } = require('../integrations/advancedMediaIntegrationService');
const { kickWebhookDeliveryWorker } = require('../integrations/webhookDeliveryWorkerService');
const {
  aggregateDailyAnalytics,
  buildPodcastAnalyticsDashboard,
  dateKey,
} = require('./podcastAnalyticsService');

let workerHandle = null;
let workerRunning = false;
let lastDigestSweepDayKey = '';

function subtractDays(dateInput, days) {
  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function getIsoWeekKey(dateInput = new Date()) {
  const date = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return getIsoWeekKey(new Date());
  }

  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((normalized - yearStart) / 86400000) + 1) / 7);

  return `${normalized.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function isWeeklyPerformanceSendDay(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return !Number.isNaN(date.getTime()) && date.getUTCDay() === 3;
}

async function runAnalyticsAggregationCycle({ now = new Date(), lookbackDays = 7 } = {}) {
  const to = now instanceof Date ? now : new Date(now);
  const from = subtractDays(to, Math.max(1, lookbackDays));
  const rows = await aggregateDailyAnalytics({ from, to });

  return {
    from,
    to,
    aggregatedRows: rows.length,
  };
}

async function sendWeeklyPerformanceDigests({ now = new Date(), logger = console, appUrl } = {}) {
  const currentWeekKey = getIsoWeekKey(now);
  const rangeFrom = subtractDays(now, 6);
  const rangeTo = now instanceof Date ? now : new Date(now);
  const users = await User.find({
    emailVerified: true,
    email: { $exists: true, $ne: '' },
  }).select('_id email name lastPodcastPerformanceEmailWeekKey');

  const summary = {
    checked: 0,
    sent: 0,
    skipped: 0,
    weekKey: currentWeekKey,
  };

  for (const user of users) {
    summary.checked += 1;

    if (user.lastPodcastPerformanceEmailWeekKey === currentWeekKey) {
      summary.skipped += 1;
      continue;
    }

    const showCount = await PodcastShow.countDocuments({ userId: user._id });
    if (!showCount) {
      summary.skipped += 1;
      continue;
    }

    const analytics = await buildPodcastAnalyticsDashboard({
      userId: user._id,
      from: rangeFrom,
      to: rangeTo,
    });

    const result = await sendPodcastPerformanceEmail({
      user,
      analytics,
      appUrl,
    });

    if (result.delivered || result.devFallback) {
      await queueWebhookDeliveries({
        userId: user._id,
        eventType: 'analytics.weekly_summary',
        baseUrl: appUrl || process.env.APP_URL || 'http://localhost:3000',
        metadata: {
          weekKey: currentWeekKey,
          totals: analytics.totals,
          topEpisodeTitle: analytics.topEpisodes?.[0]?.title || '',
        },
      });
      kickWebhookDeliveryWorker(logger);
      user.lastPodcastPerformanceEmailSentAt = new Date(now);
      user.lastPodcastPerformanceEmailWeekKey = currentWeekKey;
      await user.save();
      summary.sent += 1;
      continue;
    }

    summary.skipped += 1;
    logger.error(`VicPods performance email not delivered for ${user.email}.`);
  }

  return summary;
}

async function runPodcastPerformanceMaintenance({ now = new Date(), logger = console, appUrl } = {}) {
  const aggregation = await runAnalyticsAggregationCycle({ now });
  let digests = {
    checked: 0,
    sent: 0,
    skipped: 0,
    weekKey: getIsoWeekKey(now),
  };
  const currentDayKey = dateKey(now);

  if (isWeeklyPerformanceSendDay(now) && lastDigestSweepDayKey !== currentDayKey) {
    digests = await sendWeeklyPerformanceDigests({ now, logger, appUrl });
    lastDigestSweepDayKey = currentDayKey;
  }

  return {
    aggregation,
    digests,
  };
}

function kickPodcastPerformanceAggregation(logger = console) {
  setImmediate(() => {
    runAnalyticsAggregationCycle().catch((error) => {
      logger.error('VicPods analytics aggregation kick failed: ' + error.message);
    });
  });
}

function startPodcastPerformanceWorker({ intervalMs = 10 * 60 * 1000, logger = console, appUrl } = {}) {
  if (workerHandle || process.env.PODCAST_PERFORMANCE_WORKER_DISABLED === 'true') {
    return workerHandle;
  }

  workerHandle = setInterval(async () => {
    if (workerRunning) {
      return;
    }

    workerRunning = true;
    try {
      await runPodcastPerformanceMaintenance({ logger, appUrl });
    } catch (error) {
      logger.error('VicPods podcast performance worker failed: ' + error.message);
    } finally {
      workerRunning = false;
    }
  }, Math.max(60 * 1000, intervalMs));

  if (typeof workerHandle.unref === 'function') {
    workerHandle.unref();
  }

  kickPodcastPerformanceAggregation(logger);
  return workerHandle;
}

function stopPodcastPerformanceWorker() {
  if (workerHandle) {
    clearInterval(workerHandle);
    workerHandle = null;
  }
}

module.exports = {
  getIsoWeekKey,
  isWeeklyPerformanceSendDay,
  kickPodcastPerformanceAggregation,
  runAnalyticsAggregationCycle,
  runPodcastPerformanceMaintenance,
  sendWeeklyPerformanceDigests,
  startPodcastPerformanceWorker,
  stopPodcastPerformanceWorker,
};
