const Episode = require('../models/Episode');
const Idea = require('../models/Idea');
const PodcastShow = require('../models/PodcastShow');
const Series = require('../models/Series');
const {
  getBaseDailyLimitForPlan,
  getDailyLimitForUser,
} = require('../services/limitService');
const { buildActivationChecklist } = require('../services/marketing/activationChecklistService');
const { buildReferralProgramViewModel } = require('../services/marketing/referralService');
const { buildPodcastAnalyticsDashboard } = require('../services/analytics/podcastAnalyticsService');
const {
  buildCreatorMonetizationDashboard,
  ensurePrivateFeedToken,
  normalizeSupportLinks,
} = require('../services/monetization/creatorMonetizationService');
const { buildStudioCommandCenter } = require('../services/studio/studioCommandCenterService');
const {
  buildTeamWorkflowDashboard,
  normalizeBrandKitInput,
  normalizeCollaboratorInput,
} = require('../services/team/teamWorkflowService');
const { inviteShowCollaborator } = require('../services/team/collaboratorInviteService');
const { ShowCollaborator } = require('../models/ShowCollaborator');
const {
  buildAdvancedMediaDashboard,
  normalizeConnectionInput,
  queueConnectionTestDelivery,
} = require('../services/integrations/advancedMediaIntegrationService');
const { IntegrationConnection } = require('../models/IntegrationConnection');
const { retryWebhookDelivery, kickWebhookDeliveryWorker } = require('../services/integrations/webhookDeliveryWorkerService');
const { buildRequestBaseUrl } = require('../utils/requestUrl');
const { renderPage } = require('../utils/render');

const INSPECT_KEYS = new Set(['series', 'episodes', 'single', 'ready', 'served', 'ideas', 'ai']);

function getEpisodeInspectQuery(userId, inspectKey) {
  const query = { userId };

  if (inspectKey === 'single') {
    query.isSingle = true;
  } else if (inspectKey === 'ready') {
    query.status = 'Ready';
  } else if (inspectKey === 'served') {
    query.status = 'Served';
  }

  return query;
}

async function getInspectPanel({ userId, inspectKey, t = (key, fallback) => fallback }) {
  if (!INSPECT_KEYS.has(inspectKey)) {
    return null;
  }

  if (inspectKey === 'series') {
    const items = await Series.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('name description createdAt updatedAt creationMode');

    return {
      key: inspectKey,
      title: t('studio.inspect.series', 'Series List'),
      items,
    };
  }

  if (inspectKey === 'ideas') {
    const items = await Idea.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('hook tag notes updatedAt');

    return {
      key: inspectKey,
      title: t('studio.inspect.ideas', 'Ideas List'),
      items,
    };
  }

  if (inspectKey === 'ai') {
    return {
      key: inspectKey,
      title: t('studio.inspect.ai', 'Chef AI Usage'),
      items: [],
    };
  }

  const items = await Episode.find(getEpisodeInspectQuery(userId, inspectKey))
    .sort({ updatedAt: -1 })
    .limit(50)
    .populate('seriesId')
    .populate('themeId');

  const titleByKey = {
    episodes: t('studio.inspect.episodes', 'All Episodes'),
    single: t('studio.inspect.single', 'Single Episodes'),
    ready: t('studio.inspect.ready', 'Ready Episodes'),
    served: t('studio.inspect.served', 'Served Episodes'),
  };

  return {
    key: inspectKey,
    title: titleByKey[inspectKey] || t('studio.inspect.default', 'Episodes'),
    items,
  };
}

async function showStudio(req, res, next) {
  try {
    const userId = req.currentUser._id;
    const effectivePlan = req.effectivePlan || req.currentUser.plan || 'free';
    const planLimit = getDailyLimitForUser(req.currentUser, effectivePlan);
    const basePlanLimit = getBaseDailyLimitForPlan(effectivePlan);
    const selectedFilter = String(req.query.filter || 'all').toLowerCase();
    const selectedInspect = String(req.query.inspect || '').toLowerCase();

    const episodeQuery = { userId };
    if (selectedFilter === 'single') {
      episodeQuery.isSingle = true;
    } else if (selectedFilter === 'series') {
      episodeQuery.isSingle = { $ne: true };
    } else if (selectedFilter === 'ready') {
      episodeQuery.status = 'Ready';
    } else if (selectedFilter === 'served') {
      episodeQuery.status = 'Served';
    }

    const [
      seriesCount,
      episodeCount,
      servedCount,
      readyCount,
      singleEpisodeCount,
      ideaCount,
      latestEpisodes,
      inspectPanel,
      activationChecklist,
      referralProgram,
      commandCenter,
    ] = await Promise.all([
      Series.countDocuments({ userId }),
      Episode.countDocuments({ userId }),
      Episode.countDocuments({ userId, status: 'Served' }),
      Episode.countDocuments({ userId, status: 'Ready' }),
      Episode.countDocuments({ userId, isSingle: true }),
      Idea.countDocuments({ userId }),
      Episode.find(episodeQuery)
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate('seriesId')
        .populate('themeId'),
      getInspectPanel({ userId, inspectKey: selectedInspect, t: req.t }),
      buildActivationChecklist({ userId }),
      buildReferralProgramViewModel(req.currentUser, {
        appUrl: process.env.APP_URL || 'http://localhost:3000',
      }),
      buildStudioCommandCenter({
        userId,
        baseUrl: buildRequestBaseUrl(req),
      }),
    ]);

    return renderPage(res, {
      title: req.t('page.studio.title', 'Studio - VicPods'),
      pageTitle: req.t('page.studio.header', 'Studio'),
      subtitle: req.t('page.studio.subtitle', 'Your podcast command center.'),
      view: 'studio/index',
      data: {
        stats: {
          seriesCount,
          episodeCount,
          servedCount,
          readyCount,
          singleEpisodeCount,
          ideaCount,
          aiRemaining: planLimit === Infinity
            ? req.t('studio.ai.unlimited', 'Unlimited')
            : Math.max(planLimit - req.currentUser.aiDailyCount, 0),
          aiLimit: planLimit === Infinity ? null : planLimit,
          aiBaseLimit: basePlanLimit === Infinity ? null : basePlanLimit,
          aiLimitNote: planLimit === Infinity
            ? 'Usage details'
            : (planLimit > basePlanLimit
              ? `${basePlanLimit} base · +${planLimit - basePlanLimit} referral bonus`
              : 'Usage details'),
        },
        latestEpisodes,
        selectedFilter,
        selectedInspect,
        inspectPanel,
        activationChecklist,
        referralProgram,
        commandCenter,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function showStudioCalendar(req, res, next) {
  try {
    const commandCenter = await buildStudioCommandCenter({
      userId: req.currentUser._id,
      baseUrl: buildRequestBaseUrl(req),
    });

    return res.json({
      calendar: {
        items: commandCenter.calendarItems,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function showAnalytics(req, res, next) {
  try {
    const analytics = await buildPodcastAnalyticsDashboard({
      userId: req.currentUser._id,
      from: req.query.from,
      to: req.query.to,
    });

    return renderPage(res, {
      title: 'Analytics - VicPods',
      pageTitle: 'Analytics',
      subtitle: 'Podcast performance and growth signals.',
      view: 'studio/analytics',
      data: {
        analytics,
        performanceDigest: {
          lastSentAt: req.currentUser.lastPodcastPerformanceEmailSentAt || null,
          lastWeekKey: req.currentUser.lastPodcastPerformanceEmailWeekKey || '',
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

function numberOrNull(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseSupportLinks(body) {
  const labels = Array.isArray(body.supportLinkLabel) ? body.supportLinkLabel : [body.supportLinkLabel];
  const urls = Array.isArray(body.supportLinkUrl) ? body.supportLinkUrl : [body.supportLinkUrl];
  const providers = Array.isArray(body.supportLinkProvider) ? body.supportLinkProvider : [body.supportLinkProvider];

  return normalizeSupportLinks(labels.map((label, index) => ({
    label,
    url: urls[index],
    provider: providers[index],
  })));
}

async function showMonetization(req, res, next) {
  try {
    const analytics = await buildPodcastAnalyticsDashboard({
      userId: req.currentUser._id,
    });
    const monetization = await buildCreatorMonetizationDashboard({
      userId: req.currentUser._id,
      baseUrl: buildRequestBaseUrl(req),
      analytics,
    });

    return renderPage(res, {
      title: 'Monetization - VicPods',
      pageTitle: 'Monetization',
      subtitle: 'Support links, premium feeds, sponsor kits, outreach templates, and ad planning.',
      view: 'studio/monetization',
      data: {
        monetization,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function updateShowMonetization(req, res, next) {
  try {
    const privateFeedPriceId = String(req.body.privateFeedPriceId || '').trim().slice(0, 120);
    if (req.body.privateFeedsEnabled === 'on' && privateFeedPriceId && !privateFeedPriceId.startsWith('price_')) {
      req.flash('error', 'Stripe private feed price IDs should start with price_.');
      return res.redirect('/studio/monetization');
    }

    const show = await PodcastShow.findOne({
      _id: req.params.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      req.flash('error', 'Hosted show not found.');
      return res.redirect('/studio/monetization');
    }

    show.monetization = {
      ...(show.monetization?.toObject ? show.monetization.toObject() : show.monetization || {}),
      supportLinks: parseSupportLinks(req.body),
      premiumEnabled: req.body.premiumEnabled === 'on',
      privateFeedsEnabled: req.body.privateFeedsEnabled === 'on',
      privateFeedTitle: String(req.body.privateFeedTitle || '').trim().slice(0, 120),
      privateFeedDescription: String(req.body.privateFeedDescription || '').trim().slice(0, 600),
      privateFeedPriceId,
      privateFeedCtaLabel: String(req.body.privateFeedCtaLabel || '').trim().slice(0, 80),
      sponsorContactEmail: String(req.body.sponsorContactEmail || '').trim().toLowerCase().slice(0, 200),
      sponsorPitch: String(req.body.sponsorPitch || '').trim().slice(0, 1200),
      audienceSummary: String(req.body.audienceSummary || '').trim().slice(0, 1200),
      rateCard: {
        preRoll: numberOrNull(req.body.preRollRate),
        midRoll: numberOrNull(req.body.midRollRate),
        postRoll: numberOrNull(req.body.postRollRate),
      },
    };

    await show.save();

    if (show.monetization.privateFeedsEnabled) {
      await ensurePrivateFeedToken({
        userId: req.currentUser._id,
        showId: show._id,
      });
    }

    req.flash('success', 'Monetization settings saved.');
    return res.redirect('/studio/monetization');
  } catch (error) {
    return next(error);
  }
}

async function showTeams(req, res, next) {
  try {
    const teamWorkflow = await buildTeamWorkflowDashboard({
      userId: req.currentUser._id,
    });

    return renderPage(res, {
      title: 'Teams - VicPods',
      pageTitle: 'Teams',
      subtitle: 'Collaborators, roles, approvals, brand kit, and multi-show operations.',
      view: 'studio/teams',
      data: {
        teamWorkflow,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function addShowCollaborator(req, res, next) {
  try {
    const show = await PodcastShow.findOne({
      _id: req.params.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      req.flash('error', 'Hosted show not found.');
      return res.redirect('/studio/teams');
    }

    const input = normalizeCollaboratorInput(req.body);
    if (!input.email) {
      req.flash('error', 'Collaborator email is required.');
      return res.redirect('/studio/teams');
    }

    const result = await inviteShowCollaborator({
      ownerUser: req.currentUser,
      show,
      input: {
        ...input,
        inviteMessage: req.body.inviteMessage,
      },
      appUrl: buildRequestBaseUrl(req) || process.env.APP_URL,
    });

    if (result.acceptedImmediately) {
      req.flash('success', 'Collaborator linked to your account access immediately.');
      return res.redirect('/studio/teams');
    }

    req.flash(
      'success',
      result.emailResult?.delivered || result.emailResult?.devFallback
        ? `Invite sent to ${input.email}.`
        : `Collaborator saved for ${input.email}.`
    );
    return res.redirect('/studio/teams');
  } catch (error) {
    return next(error);
  }
}

async function updateShowBrandKit(req, res, next) {
  try {
    const show = await PodcastShow.findOne({
      _id: req.params.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      req.flash('error', 'Hosted show not found.');
      return res.redirect('/studio/teams');
    }

    show.brandKit = normalizeBrandKitInput(req.body, show.brandKit);
    await show.save();

    req.flash('success', 'Brand kit saved.');
    return res.redirect('/studio/teams');
  } catch (error) {
    return next(error);
  }
}

async function showIntegrations(req, res, next) {
  try {
    const integrations = await buildAdvancedMediaDashboard({
      userId: req.currentUser._id,
    });

    return renderPage(res, {
      title: 'Integrations - VicPods',
      pageTitle: 'Integrations',
      subtitle: 'Webhooks, Zapier, email platforms, social sharing, media exports, captions, clips, and cleanup workflows.',
      view: 'studio/integrations',
      data: {
        integrations,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function saveIntegrationConnection(req, res, next) {
  try {
    const input = normalizeConnectionInput(req.body);

    if (['webhook', 'zapier'].includes(input.provider) && !input.endpointUrl) {
      req.flash('error', 'Add a valid webhook or Zapier endpoint URL.');
      return res.redirect('/studio/integrations');
    }

    if (!input.events.length) {
      req.flash('error', 'Choose at least one event for this connection.');
      return res.redirect('/studio/integrations');
    }

    await IntegrationConnection.create({
      userId: req.currentUser._id,
      ...input,
    });

    req.flash('success', 'Integration connection saved.');
    return res.redirect('/studio/integrations');
  } catch (error) {
    return next(error);
  }
}

async function sendIntegrationConnectionTest(req, res, next) {
  try {
    const connection = await IntegrationConnection.findOne({
      _id: req.params.connectionId,
      userId: req.currentUser._id,
    });

    if (!connection) {
      req.flash('error', 'Integration connection not found.');
      return res.redirect('/studio/integrations');
    }

    await queueConnectionTestDelivery({
      connection,
      userId: req.currentUser._id,
      baseUrl: buildRequestBaseUrl(req),
    });
    kickWebhookDeliveryWorker(console);

    req.flash('success', 'Test delivery queued.');
    return res.redirect('/studio/integrations');
  } catch (error) {
    return next(error);
  }
}

async function retryIntegrationDelivery(req, res, next) {
  try {
    const delivery = await retryWebhookDelivery({
      userId: req.currentUser._id,
      deliveryId: req.params.deliveryId,
    });

    if (!delivery) {
      req.flash('error', 'Webhook delivery not found.');
      return res.redirect('/studio/integrations');
    }

    kickWebhookDeliveryWorker(console);
    req.flash('success', 'Webhook delivery queued for retry.');
    return res.redirect('/studio/integrations');
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  addShowCollaborator,
  retryIntegrationDelivery,
  sendIntegrationConnectionTest,
  showAnalytics,
  showMonetization,
  showStudioCalendar,
  showStudio,
  showTeams,
  showIntegrations,
  saveIntegrationConnection,
  updateShowBrandKit,
  updateShowMonetization,
};
