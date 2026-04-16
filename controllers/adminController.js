const AdminAccessLog = require('../models/AdminAccessLog');
const AppActivityEvent = require('../models/AppActivityEvent');
const { CreatorPartner } = require('../models/CreatorPartner');
const Episode = require('../models/Episode');
const Idea = require('../models/Idea');
const PublicPreviewLead = require('../models/PublicPreviewLead');
const Series = require('../models/Series');
const User = require('../models/User');
const {
  CREATOR_PARTNER_STATUSES,
  DEFAULT_CREATOR_PREMIUM_DAYS,
  buildCreatorPartnerInviteUrl,
  grantCreatorPartnerPremiumAccess,
  upsertCreatorPartnerFromAdmin,
} = require('../services/marketing/creatorPartnerService');
const { sendCreatorPremiumWelcomeEmail } = require('../services/email/creatorWelcomeEmailService');
const { buildHumanActivityMatch } = require('../services/analytics/trafficQualityService');
const { renderPage } = require('../utils/render');

const PAID_PLANS = ['pro', 'premium'];
const ACTIVE_PAID_STATUSES = ['active', 'trialing'];
const PAYMENT_RISK_STATUSES = ['past_due', 'unpaid'];
const GRANTED_ADMIN_OUTCOMES = ['granted', 'granted_dev'];
const ANALYTICS_TIME_ZONE = String(process.env.ADMIN_ANALYTICS_TIMEZONE || process.env.TZ || 'Europe/Dublin').trim() || 'Europe/Dublin';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ANALYTICS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dayLabelFormatter = new Intl.DateTimeFormat('en-IE', {
  timeZone: ANALYTICS_TIME_ZONE,
  month: 'short',
  day: 'numeric',
});

const dayFullLabelFormatter = new Intl.DateTimeFormat('en-IE', {
  timeZone: ANALYTICS_TIME_ZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const hourKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ANALYTICS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

const hourLabelFormatter = new Intl.DateTimeFormat('en-IE', {
  timeZone: ANALYTICS_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function buildCountMap(rows, seed) {
  const output = { ...seed };
  (rows || []).forEach((row) => {
    if (row && row._id && Object.prototype.hasOwnProperty.call(output, row._id)) {
      output[row._id] = row.count;
    }
  });
  return output;
}

function buildDashboardUrl(req) {
  const key = String(req.query?.key || '').trim();
  return `${req.baseUrl || '/control-room-ops'}${key ? `?key=${encodeURIComponent(key)}` : ''}`;
}

function formatCreatorStatusLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatterPartsToObject(formatter, date) {
  return formatter.formatToParts(new Date(date)).reduce((parts, part) => {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
    return parts;
  }, {});
}

function formatDayKey(date) {
  const parts = formatterPartsToObject(dayKeyFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatHourKey(date) {
  const parts = formatterPartsToObject(hourKeyFormatter, date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}`;
}

function formatDelta(current, previous) {
  if (!previous) {
    return current > 0 ? '+100%' : '0%';
  }

  const delta = ((current - previous) / previous) * 100;
  const rounded = Math.round(delta);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function buildTrafficChart(pageViewEvents, now) {
  const dailyBuckets = [];
  const dailyBucketMap = new Map();

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - (offset * DAY_MS));
    const key = formatDayKey(date);
    const bucket = {
      key,
      shortLabel: dayLabelFormatter.format(date),
      fullLabel: dayFullLabelFormatter.format(date),
      pageViews: 0,
      visitors: new Set(),
    };
    dailyBuckets.push(bucket);
    dailyBucketMap.set(key, bucket);
  }

  const hourlyBuckets = [];
  const hourlyBucketMap = new Map();

  for (let offset = 23; offset >= 0; offset -= 1) {
    const date = new Date(now.getTime() - (offset * HOUR_MS));
    const key = formatHourKey(date);
    const bucket = {
      key,
      shortLabel: hourLabelFormatter.format(date),
      pageViews: 0,
    };
    hourlyBuckets.push(bucket);
    hourlyBucketMap.set(key, bucket);
  }

  const last24hStart = now.getTime() - DAY_MS;
  const previous24hStart = now.getTime() - (2 * DAY_MS);
  let previous24hPageViews = 0;

  (pageViewEvents || []).forEach((event) => {
    const createdAt = new Date(event.createdAt);
    const visitorId = String(event.visitorId || '').trim();
    const dayBucket = dailyBucketMap.get(formatDayKey(createdAt));

    if (dayBucket) {
      dayBucket.pageViews += 1;
      if (visitorId) {
        dayBucket.visitors.add(visitorId);
      }
    }

    const hourBucket = hourlyBucketMap.get(formatHourKey(createdAt));
    if (hourBucket) {
      hourBucket.pageViews += 1;
    }

    const createdAtMs = createdAt.getTime();
    if (createdAtMs >= previous24hStart && createdAtMs < last24hStart) {
      previous24hPageViews += 1;
    }
  });

  const dailyMaxPageViews = Math.max(...dailyBuckets.map((bucket) => bucket.pageViews), 1);
  const dailyMaxVisitors = Math.max(...dailyBuckets.map((bucket) => bucket.visitors.size), 1);
  const hourlyMaxPageViews = Math.max(...hourlyBuckets.map((bucket) => bucket.pageViews), 1);
  const dailyPageViewTotal = dailyBuckets.reduce((sum, bucket) => sum + bucket.pageViews, 0);
  const averageDailyPageViews = Math.round(dailyPageViewTotal / dailyBuckets.length);
  const busiestDay = dailyBuckets.reduce((best, bucket) => (
    !best || bucket.pageViews > best.pageViews ? bucket : best
  ), null);

  return {
    timeZone: ANALYTICS_TIME_ZONE,
    last24hDelta: formatDelta(hourlyBuckets.reduce((sum, bucket) => sum + bucket.pageViews, 0), previous24hPageViews),
    previous24hPageViews,
    averageDailyPageViews,
    busiestDay: busiestDay
      ? {
        label: busiestDay.fullLabel,
        pageViews: busiestDay.pageViews,
      }
      : null,
    dailyPageViews: dailyBuckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.shortLabel,
      fullLabel: bucket.fullLabel,
      value: bucket.pageViews,
      height: bucket.pageViews > 0
        ? Math.max(8, Math.round((bucket.pageViews / dailyMaxPageViews) * 100))
        : 0,
      isToday: bucket.key === formatDayKey(now),
    })),
    dailyVisitors: dailyBuckets.map((bucket) => ({
      key: bucket.key,
      label: bucket.shortLabel,
      fullLabel: bucket.fullLabel,
      value: bucket.visitors.size,
      height: bucket.visitors.size > 0
        ? Math.max(8, Math.round((bucket.visitors.size / dailyMaxVisitors) * 100))
        : 0,
      isToday: bucket.key === formatDayKey(now),
    })),
    hourlyPageViews: hourlyBuckets.map((bucket, index) => ({
      key: bucket.key,
      label: index % 4 === 0 ? bucket.shortLabel : '',
      fullLabel: bucket.shortLabel,
      value: bucket.pageViews,
      height: bucket.pageViews > 0
        ? Math.max(6, Math.round((bucket.pageViews / hourlyMaxPageViews) * 100))
        : 0,
    })),
  };
}

async function showDashboard(req, res, next) {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    const last7d = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
    const last30d = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const last14d = new Date(now.getTime() - (14 * DAY_MS));
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      usersLast24h,
      usersLast7d,
      usersLast30d,
      totalSubscribers,
      activePaidUsers,
      paymentRiskUsers,
      totalSeries,
      totalEpisodes,
      totalIdeas,
      episodesLast24h,
      episodesLast7d,
      seriesLast7d,
      ideasLast7d,
      planBreakdownRaw,
      episodeStatusRaw,
      aiUsageTodayRaw,
      recentUsers,
      userDirectory,
      recentEpisodes,
      recentIdeas,
      pageViews24h,
      uniqueVisitors7d,
      signupsCompleted7d,
      signupsStarted7d,
      logins7d,
      publicEpisodePreviews7d,
      publicPodcastIdeas7d,
      publicPreviewSaves7d,
      publicPreviewExports7d,
      episodesCreated7d,
      episodeDrafts7d,
      billingViews7d,
      checkoutStarts7d,
      checkoutCompleted7d,
      humanPageViewEvents14d,
      totalPreviewLeads,
      recentPreviewLeads7d,
      previewLeadBreakdownRaw,
      recentPreviewLeads,
      creatorPartnersRaw,
      creatorAttributionRaw,
      recentActivityEvents,
      adminAccessAttempts24h,
      blockedAdminAttempts7d,
      uniqueAdminIps7d,
      recentAdminAccess,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: last24h } }),
      User.countDocuments({ createdAt: { $gte: last7d } }),
      User.countDocuments({ createdAt: { $gte: last30d } }),
      User.countDocuments({ plan: { $in: PAID_PLANS } }),
      User.countDocuments({
        plan: { $in: PAID_PLANS },
        planStatus: { $in: ACTIVE_PAID_STATUSES },
      }),
      User.countDocuments({
        plan: { $in: PAID_PLANS },
        planStatus: { $in: PAYMENT_RISK_STATUSES },
      }),
      Series.countDocuments({}),
      Episode.countDocuments({}),
      Idea.countDocuments({}),
      Episode.countDocuments({ createdAt: { $gte: last24h } }),
      Episode.countDocuments({ createdAt: { $gte: last7d } }),
      Series.countDocuments({ createdAt: { $gte: last7d } }),
      Idea.countDocuments({ createdAt: { $gte: last7d } }),
      User.aggregate([
        { $group: { _id: '$plan', count: { $sum: 1 } } },
      ]),
      Episode.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      User.aggregate([
        {
          $match: {
            aiDailyResetDate: { $gte: startOfToday },
            aiDailyCount: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: '$aiDailyCount' },
            activeUsers: { $sum: 1 },
          },
        },
      ]),
      User.find({})
        .sort({ createdAt: -1 })
        .limit(12)
        .select('name email createdAt plan planStatus emailVerified authProvider'),
      User.find({})
        .sort({ createdAt: -1 })
        .select('name email createdAt plan planStatus emailVerified authProvider'),
      Episode.find({})
        .sort({ updatedAt: -1 })
        .limit(8)
        .select('title status isSingle episodeNumberWithinTheme updatedAt userId seriesId')
        .populate({ path: 'userId', select: 'name email' })
        .populate({ path: 'seriesId', select: 'name' }),
      Idea.find({})
        .sort({ updatedAt: -1 })
        .limit(8)
        .select('hook tag updatedAt userId')
        .populate({ path: 'userId', select: 'name email' }),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'page_view',
        createdAt: { $gte: last24h },
      })),
      AppActivityEvent.distinct('visitorId', buildHumanActivityMatch({
        createdAt: { $gte: last7d },
        visitorId: { $ne: '' },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'signup_completed',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'signup_started',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'login_success',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'public_episode_preview_generated',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'public_podcast_ideas_generated',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'public_preview_saved',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'public_preview_exported',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'episode_created',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'episode_draft_generated',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'billing_page_viewed',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'billing_checkout_started',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.countDocuments(buildHumanActivityMatch({
        eventType: 'billing_checkout_completed',
        createdAt: { $gte: last7d },
      })),
      AppActivityEvent.find(buildHumanActivityMatch({
        eventType: 'page_view',
        createdAt: { $gte: last14d },
      }))
        .select('createdAt visitorId')
        .sort({ createdAt: 1 })
        .lean(),
      PublicPreviewLead.countDocuments({}),
      PublicPreviewLead.countDocuments({
        lastSavedAt: { $gte: last7d },
      }),
      PublicPreviewLead.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      PublicPreviewLead.find({})
        .sort({ lastSavedAt: -1, updatedAt: -1 })
        .limit(12)
        .select('email source sourceInput captureCount lastSavedAt lastSentAt'),
      CreatorPartner.find({})
        .sort({ updatedAt: -1, createdAt: -1 })
        .populate({ path: 'assignedUserId', select: 'name email plan planStatus currentPeriodEnd' })
        .lean(),
      User.aggregate([
        {
          $match: {
            referredByCreatorPartnerId: { $ne: null },
          },
        },
        {
          $group: {
            _id: '$referredByCreatorPartnerId',
            signups: { $sum: 1 },
            paid: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$plan', PAID_PLANS] },
                      { $in: ['$planStatus', ACTIVE_PAID_STATUSES] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            latestSignupAt: { $max: '$createdAt' },
          },
        },
      ]),
      AppActivityEvent.find(buildHumanActivityMatch({}))
        .sort({ createdAt: -1 })
        .limit(16)
        .select('eventType requestPath visitorId userEmail authProvider statusCode createdAt'),
      AdminAccessLog.countDocuments({ createdAt: { $gte: last24h } }),
      AdminAccessLog.countDocuments({
        createdAt: { $gte: last7d },
        outcome: { $nin: GRANTED_ADMIN_OUTCOMES },
      }),
      AdminAccessLog.distinct('ipAddress', {
        createdAt: { $gte: last7d },
        ipAddress: { $ne: '' },
      }),
      AdminAccessLog.find({})
        .sort({ createdAt: -1 })
        .limit(12)
        .select('outcome requestPath ipAddress userEmail userRole keySource hasAdminKey createdAt'),
    ]);

    const planBreakdown = buildCountMap(planBreakdownRaw, {
      free: 0,
      pro: 0,
      premium: 0,
    });

    const episodeStatus = buildCountMap(episodeStatusRaw, {
      Planned: 0,
      Draft: 0,
      Ready: 0,
      Served: 0,
    });

    const aiUsageToday = aiUsageTodayRaw && aiUsageTodayRaw[0]
      ? aiUsageTodayRaw[0]
      : { totalCalls: 0, activeUsers: 0 };
    const previewLeadBreakdown = buildCountMap(previewLeadBreakdownRaw, {
      episode_preview: 0,
      podcast_ideas: 0,
    });
    const creatorAttributionMap = new Map(
      (creatorAttributionRaw || []).map((row) => [String(row._id), row])
    );
    const creatorPartners = (creatorPartnersRaw || []).map((partner) => {
      const attribution = creatorAttributionMap.get(String(partner._id)) || {};
      const assignedUser = partner.assignedUserId || null;
      const premiumAccessExpiresAt = partner.premiumAccessExpiresAt ? new Date(partner.premiumAccessExpiresAt) : null;
      const premiumAccessActive = Boolean(
        premiumAccessExpiresAt && premiumAccessExpiresAt.getTime() > now.getTime()
      );

      return {
        ...partner,
        inviteUrl: buildCreatorPartnerInviteUrl(partner, { appUrl: process.env.APP_URL }),
        statusLabel: formatCreatorStatusLabel(partner.status),
        signupCount: Number(attribution.signups || 0),
        paidConversionCount: Number(attribution.paid || 0),
        latestSignupAt: attribution.latestSignupAt || null,
        assignedUser,
        hasAssignedUser: Boolean(assignedUser?._id),
        premiumAccessActive,
      };
    });
    const creatorMetrics = creatorPartners.reduce((summary, partner) => {
      summary.total += 1;
      summary.signups += partner.signupCount;
      summary.paid += partner.paidConversionCount;
      if (['access_sent', 'testing', 'approved', 'posted', 'converted'].includes(partner.status)) {
        summary.activePipeline += 1;
      }
      if (partner.status === 'posted' || partner.status === 'converted') {
        summary.posted += 1;
      }
      return summary;
    }, {
      total: 0,
      activePipeline: 0,
      posted: 0,
      signups: 0,
      paid: 0,
    });
    const trafficChart = buildTrafficChart(humanPageViewEvents14d, now);

    const signupEmailList = recentUsers
      .map((user) => String(user.email || '').trim())
      .filter(Boolean)
      .join('\n');

    return renderPage(res, {
      title: req.t('page.admin.title', 'Admin Dashboard - VicPods'),
      pageTitle: req.t('page.admin.header', 'Admin Dashboard'),
      subtitle: req.t('page.admin.subtitle', 'Secret operations panel for subscriptions, paid usage, and product activity.'),
      view: 'admin/dashboard',
      data: {
        dashboardPath: req.baseUrl || '/control-room-ops',
        dashboardUrl: buildDashboardUrl(req),
        adminKey: String(req.query?.key || '').trim(),
        secretKeyEnabled: Boolean(String(process.env.ADMIN_DASHBOARD_KEY || '').trim()),
        creatorPartnerStatuses: CREATOR_PARTNER_STATUSES,
        creatorDefaultPremiumDays: DEFAULT_CREATOR_PREMIUM_DAYS,
        metrics: {
          totalUsers,
          usersLast24h,
          usersLast7d,
          usersLast30d,
          totalSubscribers,
          activePaidUsers,
          paymentRiskUsers,
          totalSeries,
          totalEpisodes,
          totalIdeas,
          episodesLast24h,
          episodesLast7d,
          seriesLast7d,
          ideasLast7d,
          aiCallsToday: aiUsageToday.totalCalls || 0,
          aiActiveUsersToday: aiUsageToday.activeUsers || 0,
          pageViews24h,
          uniqueVisitors7d: uniqueVisitors7d.length,
          signupsCompleted7d,
          signupsStarted7d,
          logins7d,
          publicEpisodePreviews7d,
          publicPodcastIdeas7d,
          publicPreviewSaves7d,
          publicPreviewExports7d,
          episodesCreated7d,
          episodeDrafts7d,
          billingViews7d,
          checkoutStarts7d,
          checkoutCompleted7d,
          totalPreviewLeads,
          recentPreviewLeads7d,
          creatorPartnersTotal: creatorMetrics.total,
          creatorPartnersActivePipeline: creatorMetrics.activePipeline,
          creatorPartnersPosted: creatorMetrics.posted,
          creatorPartnerSignups: creatorMetrics.signups,
          creatorPartnerPaid: creatorMetrics.paid,
          adminAccessAttempts24h,
          blockedAdminAttempts7d,
          uniqueAdminIps7d: uniqueAdminIps7d.length,
        },
        breakdown: {
          plans: planBreakdown,
          episodeStatus,
          previewLeads: previewLeadBreakdown,
        },
        recentUsers,
        userDirectory,
        signupEmailList,
        creatorPartners,
        trafficChart,
        recentPreviewLeads,
        recentEpisodes,
        recentIdeas,
        recentActivityEvents,
        recentAdminAccess,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function upsertCreatorPartner(req, res, next) {
  try {
    const partnerId = String(req.body.partnerId || '').trim();
    const partner = await upsertCreatorPartnerFromAdmin({
      partnerId,
      body: req.body,
      adminUser: req.currentUser,
    });

    req.flash('success', `${partner.name} saved in the creator pipeline.`);
    return res.redirect(buildDashboardUrl(req));
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(buildDashboardUrl(req));
    }

    return next(error);
  }
}

async function grantCreatorPartnerAccess(req, res, next) {
  try {
    const result = await grantCreatorPartnerPremiumAccess({
      partnerId: req.params.partnerId,
      adminUser: req.currentUser,
      durationDays: DEFAULT_CREATOR_PREMIUM_DAYS,
    });

    const creatorInviteUrl = buildCreatorPartnerInviteUrl(result.partner, { appUrl: process.env.APP_URL });
    let emailDelivered = false;
    let emailErrorMessage = '';

    try {
      const emailResult = await sendCreatorPremiumWelcomeEmail({
        to: result.user.email,
        name: result.user.name || result.partner.name,
        appUrl: process.env.APP_URL,
        expiresAt: result.expiresAt,
        creatorInviteUrl,
        accessMode: result.accessMode,
        currentPlan: result.currentPlan,
      });
      emailDelivered = Boolean(emailResult?.delivered);
    } catch (emailError) {
      emailErrorMessage = emailError.message;
    }

    const successPrefix = result.accessMode === 'existing_paid'
      ? `${result.partner.name} is already on an active ${String(result.currentPlan || 'paid').toUpperCase()} plan. Creator access was linked without changing billing.`
      : result.alreadyActive
        ? `${result.partner.name} already has active Premium access through ${new Date(result.expiresAt).toLocaleDateString()}.`
        : `Premium access granted to ${result.partner.name} until ${new Date(result.expiresAt).toLocaleDateString()}.`;

    req.flash(
      'success',
      `${successPrefix}${emailDelivered ? ' Creator welcome email sent.' : ''}`
    );
    if (emailErrorMessage) {
      req.flash('error', `Premium access was granted, but the creator email could not be sent: ${emailErrorMessage}`);
    }
    return res.redirect(buildDashboardUrl(req));
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(buildDashboardUrl(req));
    }

    return next(error);
  }
}

module.exports = {
  showDashboard,
  upsertCreatorPartner,
  grantCreatorPartnerAccess,
};
