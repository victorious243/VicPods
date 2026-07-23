const AudioAsset = require('../../models/AudioAsset');
const PodcastShow = require('../../models/PodcastShow');
const PrivateFeedToken = require('../../models/PrivateFeedToken');
const { ShowCollaborator } = require('../../models/ShowCollaborator');
const {
  getHostingPlanDefinitions,
  getIncludedHostingPlan,
  getPlanDefinition,
  maxHostingPlan,
  normalizeHostingPlan,
  normalizeWorkspacePlan,
} = require('./planCatalog');

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function bytesToGb(bytes) {
  return Number((Number(bytes || 0) / (1024 * 1024 * 1024)).toFixed(2));
}

function secondsToHours(seconds) {
  return Number((Number(seconds || 0) / 3600).toFixed(2));
}

function isAtOrOverLimit(used, limit) {
  if (limit === Infinity) {
    return false;
  }

  return Number(used || 0) >= Number(limit || 0);
}

function getEffectiveHostingPlanForBilling({ workspacePlan, hostingPlan, hostingActive = false }) {
  const includedHosting = getIncludedHostingPlan(normalizeWorkspacePlan(workspacePlan));
  const paidHosting = hostingActive ? normalizeHostingPlan(hostingPlan) : 'none';
  return maxHostingPlan(includedHosting, paidHosting);
}

async function aggregateAudioUsage(userId, { monthStart = startOfMonth() } = {}) {
  const [storageRows, monthlyRows] = await Promise.all([
    AudioAsset.aggregate([
      { $match: { userId, status: { $ne: 'replaced' } } },
      {
        $group: {
          _id: null,
          byteSize: { $sum: '$byteSize' },
          durationSeconds: { $sum: '$durationSeconds' },
        },
      },
    ]),
    AudioAsset.aggregate([
      {
        $match: {
          userId,
          status: { $ne: 'replaced' },
          createdAt: { $gte: monthStart },
        },
      },
      {
        $group: {
          _id: null,
          byteSize: { $sum: '$byteSize' },
          durationSeconds: { $sum: '$durationSeconds' },
        },
      },
    ]),
  ]);

  return {
    storageBytes: storageRows[0]?.byteSize || 0,
    totalUploadSeconds: storageRows[0]?.durationSeconds || 0,
    monthlyUploadSeconds: monthlyRows[0]?.durationSeconds || 0,
    monthlyUploadBytes: monthlyRows[0]?.byteSize || 0,
  };
}

function buildUsageMetric({ key, label, used, limit, unit = '' }) {
  const numericLimit = limit === Infinity ? Infinity : Number(limit || 0);
  const percent = numericLimit === Infinity || numericLimit <= 0
    ? 0
    : Math.min(100, Math.round((Number(used || 0) / numericLimit) * 100));

  return {
    key,
    label,
    used,
    limit: numericLimit,
    unit,
    percent,
    atLimit: isAtOrOverLimit(used, numericLimit),
  };
}

async function buildBillingUsageSnapshot({ userId, workspacePlan, hostingPlan, hostingActive = false, now = new Date() }) {
  const effectiveHostingPlan = getEffectiveHostingPlanForBilling({
    workspacePlan,
    hostingPlan,
    hostingActive,
  });
  const hostingDefinition = getPlanDefinition('hosting', effectiveHostingPlan);
  const limits = hostingDefinition.limits;
  const monthStart = startOfMonth(now);

  const [hostedShows, collaborators, privateSubscribers, audioUsage] = await Promise.all([
    PodcastShow.countDocuments({ userId }),
    ShowCollaborator.countDocuments({
      userId,
      status: { $in: ['invited', 'active'] },
    }),
    PrivateFeedToken.countDocuments({
      userId,
      accessType: 'subscriber_entitlement',
      status: 'active',
      entitlementStatus: { $in: ['active', 'trialing'] },
    }),
    aggregateAudioUsage(userId, { monthStart }),
  ]);

  const usage = {
    workspacePlan: normalizeWorkspacePlan(workspacePlan),
    storedHostingPlan: normalizeHostingPlan(hostingPlan),
    effectiveHostingPlan,
    includedHostingPlan: getIncludedHostingPlan(workspacePlan),
    hostingPlans: getHostingPlanDefinitions(),
    metrics: [
      buildUsageMetric({
        key: 'hostedShows',
        label: 'Hosted shows',
        used: hostedShows,
        limit: limits.hostedShows,
      }),
      buildUsageMetric({
        key: 'storageGb',
        label: 'Audio storage',
        used: bytesToGb(audioUsage.storageBytes),
        limit: limits.storageGb,
        unit: 'GB',
      }),
      buildUsageMetric({
        key: 'uploadHoursPerMonth',
        label: 'Upload hours this month',
        used: secondsToHours(audioUsage.monthlyUploadSeconds),
        limit: limits.uploadHoursPerMonth,
        unit: 'hr',
      }),
      buildUsageMetric({
        key: 'collaborators',
        label: 'Collaborators',
        used: collaborators,
        limit: limits.collaborators,
      }),
      buildUsageMetric({
        key: 'privateSubscribers',
        label: 'Private subscribers',
        used: privateSubscribers,
        limit: limits.privateSubscribers || 0,
      }),
    ],
    raw: {
      hostedShows,
      collaborators,
      privateSubscribers,
      storageBytes: audioUsage.storageBytes,
      monthlyUploadBytes: audioUsage.monthlyUploadBytes,
      monthlyUploadSeconds: audioUsage.monthlyUploadSeconds,
    },
  };

  return usage;
}

module.exports = {
  buildBillingUsageSnapshot,
  buildUsageMetric,
  getEffectiveHostingPlanForBilling,
  startOfMonth,
};
