const Episode = require('../models/Episode');
const PodcastShow = require('../models/PodcastShow');
const PrivateFeedToken = require('../models/PrivateFeedToken');
const { buildPublicAudioUrl } = require('../services/publish/audioStorageService');
const { buildPodcastFeedXml } = require('../services/publish/rssFeedService');
const { getStripeClient } = require('../services/stripe/stripeClient');
const {
  createPrivateFeedCheckoutSession,
  getPrivateFeedOfferConfig,
  isPrivateFeedTokenAccessible,
  syncPrivateFeedEntitlementFromCheckoutSession,
} = require('../services/monetization/privateFeedEntitlementService');
const {
  buildEpisodeSummary,
  buildPodcastFeedUrl,
  buildPodcastShowUrl,
  buildPublishedEpisodeUrl,
  publishDueEpisodesForShow,
  resolveEpisodeExplicit,
  resolveShowCoverImageUrl,
  resolveShowWebsiteUrl,
} = require('../services/publish/publishService');
const { recordPodcastAnalyticsEvent } = require('../services/analytics/podcastAnalyticsService');
const {
  buildPrivateFeedUrl,
  normalizeSupportLinks,
} = require('../services/monetization/creatorMonetizationService');
const { AppError } = require('../utils/errors');
const { buildRequestBaseUrl } = require('../utils/requestUrl');
const { renderPage } = require('../utils/render');

function formatDurationLabel(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return '';
  }

  const totalSeconds = Math.round(durationSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

async function getPublishedShowBySlug(showSlug) {
  const show = await PodcastShow.findOne({ slug: String(showSlug || '').trim() });

  if (!show) {
    throw new AppError('Podcast show not found.', 404);
  }

  return show;
}

async function getPublishedShowByHost(req) {
  const host = String(req.get('x-forwarded-host') || req.get('host') || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');

  if (!host) {
    return null;
  }

  return PodcastShow.findOne({
    'customDomain.hostname': host,
    'customDomain.status': 'active',
  });
}

function buildPrivateFeedAccessSessionValue({ show, token, baseUrl }) {
  return {
    showId: show._id.toString(),
    showSlug: show.slug,
    subscriberEmail: token.subscriberEmail || '',
    label: token.label || 'Private feed',
    accessUrl: buildPrivateFeedUrl({ show, token, baseUrl }),
    expiresAt: token.expiresAt || null,
  };
}

function formatPublishedEpisode({ show, episode, baseUrl }) {
  const summary = buildEpisodeSummary(episode) || 'Published episode from VicPods.';
  const episodeUrl = buildPublishedEpisodeUrl(show, episode, baseUrl);
  const showUrl = buildPodcastShowUrl(show, baseUrl);
  const showSupportLinks = normalizeSupportLinks(show.monetization?.supportLinks || []);
  const episodeSupportOverride = String(episode.monetization?.supportLinkOverride || '').trim();

  return {
    episodeId: String(episode._id),
    title: episode.title || 'Untitled episode',
    summary,
    description: episode.launchPack?.showNotes || episode.launchPack?.description || summary,
    publishedAt: episode.publishedAt,
    durationLabel: formatDurationLabel(episode.durationSeconds || episode.audioAssetId?.durationSeconds),
    explicit: resolveEpisodeExplicit(episode, show),
    audioUrl: buildPublicAudioUrl(episode.audioAssetId, baseUrl),
    coverImageUrl: resolveShowCoverImageUrl(show, baseUrl),
    episodeUrl,
    embedUrl: episodeUrl + '/embed',
    showUrl,
    showName: show.name,
    showDescription: show.description,
    showAuthor: show.authorName || show.name,
    showWebsiteUrl: resolveShowWebsiteUrl(show, baseUrl),
    feedUrl: buildPodcastFeedUrl(show, baseUrl),
    heroLabel: show.siteSettings?.heroLabel || 'Published with VicPods',
    heroTagline: show.siteSettings?.heroTagline || '',
    featuredLabel: show.siteSettings?.featuredLabel || '',
    featuredText: show.siteSettings?.featuredText || '',
    primaryCtaLabel: show.siteSettings?.primaryCtaLabel || '',
    primaryCtaUrl: show.siteSettings?.primaryCtaUrl || '',
    hostIntro: show.siteSettings?.hostIntro || '',
    footerNote: show.siteSettings?.footerNote || '',
    themeVariant: show.siteSettings?.themeVariant || 'studio',
    outline: Array.isArray(episode.outline) ? episode.outline.filter(Boolean) : [],
    chapters: Array.isArray(episode.chapters)
      ? episode.chapters
        .filter((chapter) => chapter && chapter.title)
        .map((chapter) => ({
          title: chapter.title,
          startSeconds: Number.isFinite(chapter.startSeconds) ? chapter.startSeconds : null,
          endSeconds: Number.isFinite(chapter.endSeconds) ? chapter.endSeconds : null,
        }))
      : [],
    visibility: episode.monetization?.visibility || 'public',
    supportLinks: episodeSupportOverride
      ? [{ label: 'Support this episode', url: episodeSupportOverride, provider: 'episode' }]
      : showSupportLinks,
  };
}

async function getPublishedEpisodes(showId) {
  return Episode.find({
    showId,
    publishStatus: 'published',
    publicPageEnabled: true,
    publishedAt: { $lte: new Date() },
    $or: [
      { 'monetization.visibility': { $exists: false } },
      { 'monetization.visibility': 'public' },
    ],
  })
    .sort({ publishedAt: -1, createdAt: -1 })
    .populate('audioAssetId');
}

async function getPrivateFeedEpisodes(showId) {
  return Episode.find({
    showId,
    publishStatus: 'published',
    publicPageEnabled: true,
    publishedAt: { $lte: new Date() },
  })
    .sort({ publishedAt: -1, createdAt: -1 })
    .populate('audioAssetId');
}

async function showPodcastFeed(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const requestBaseUrl = buildRequestBaseUrl(req);
    await publishDueEpisodesForShow(show._id);

    const episodes = await Episode.find({
      showId: show._id,
      publishStatus: 'published',
      publicPageEnabled: true,
      publishedAt: { $lte: new Date() },
      $or: [
        { 'monetization.visibility': { $exists: false } },
        { 'monetization.visibility': 'public' },
      ],
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate('audioAssetId');

    const feedXml = buildPodcastFeedXml({ show, episodes, baseUrl: requestBaseUrl });

    recordPodcastAnalyticsEvent({
      userId: show.userId,
      showId: show._id,
      episodeId: episodes[0]?._id || null,
      eventType: 'feed_request',
      source: 'rss',
      req,
      metadata: {
        episodeCount: episodes.length,
      },
    }).catch(() => {});

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(feedXml);
  } catch (error) {
    return next(error);
  }
}

async function sendPodcastFeedForShow(req, res, next, show) {
  try {
    const requestBaseUrl = buildRequestBaseUrl(req);
    await publishDueEpisodesForShow(show._id);

    const episodes = await Episode.find({
      showId: show._id,
      publishStatus: 'published',
      publicPageEnabled: true,
      publishedAt: { $lte: new Date() },
      $or: [
        { 'monetization.visibility': { $exists: false } },
        { 'monetization.visibility': 'public' },
      ],
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate('audioAssetId');

    const feedXml = buildPodcastFeedXml({ show, episodes, baseUrl: requestBaseUrl });

    recordPodcastAnalyticsEvent({
      userId: show.userId,
      showId: show._id,
      episodeId: episodes[0]?._id || null,
      eventType: 'feed_request',
      source: 'rss',
      req,
      metadata: {
        episodeCount: episodes.length,
      },
    }).catch(() => {});

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(feedXml);
  } catch (error) {
    return next(error);
  }
}

async function showPrivatePodcastFeed(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const privateToken = await PrivateFeedToken.findOne({
      showId: show._id,
      token: String(req.params.feedToken || '').trim(),
    });

    if (!show.monetization?.privateFeedsEnabled || !privateToken || !isPrivateFeedTokenAccessible(privateToken)) {
      throw new AppError('Private feed not found.', 404);
    }

    const requestBaseUrl = buildRequestBaseUrl(req);
    await publishDueEpisodesForShow(show._id);
    const episodes = await getPrivateFeedEpisodes(show._id);
    const feedXml = buildPodcastFeedXml({ show, episodes, baseUrl: requestBaseUrl });

    privateToken.lastAccessedAt = new Date();
    await privateToken.save();

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(feedXml);
  } catch (error) {
    return next(error);
  }
}

async function showPublishedShow(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const requestBaseUrl = buildRequestBaseUrl(req);
    await publishDueEpisodesForShow(show._id);

    const episodes = await getPublishedEpisodes(show._id);
    const showUrl = buildPodcastShowUrl(show, requestBaseUrl);
    const description = show.description || 'A podcast published with VicPods.';
    const publicEpisodes = episodes.map((episode) => formatPublishedEpisode({ show, episode, baseUrl: requestBaseUrl }));
    const privateFeedOffer = getPrivateFeedOfferConfig(show);
    const privateFeedAccess = req.session?.privateFeedAccess?.showId === show._id.toString()
      ? req.session.privateFeedAccess
      : null;

    if (req.session?.privateFeedAccess?.showId === show._id.toString()) {
      delete req.session.privateFeedAccess;
    }

    return renderPage(res, {
      title: show.name + ' - Podcast',
      pageTitle: show.name,
      subtitle: 'Published podcast',
      view: 'publish/show',
      data: {
        publicShell: true,
        canonicalUrl: showUrl,
        metaDescription: description,
        ogTitle: show.name + ' - Podcast',
        ogDescription: description,
        ogImage: resolveShowCoverImageUrl(show, requestBaseUrl),
        publishedShow: {
          name: show.name,
          description,
          authorName: show.authorName || show.name,
          coverImageUrl: resolveShowCoverImageUrl(show, requestBaseUrl),
          websiteUrl: resolveShowWebsiteUrl(show, requestBaseUrl),
          feedUrl: buildPodcastFeedUrl(show, requestBaseUrl),
          embedUrl: showUrl + '/embed',
          heroLabel: show.siteSettings?.heroLabel || 'Live podcast channel',
          heroTagline: show.siteSettings?.heroTagline || '',
          featuredLabel: show.siteSettings?.featuredLabel || '',
          featuredText: show.siteSettings?.featuredText || '',
          primaryCtaLabel: show.siteSettings?.primaryCtaLabel || '',
          primaryCtaUrl: show.siteSettings?.primaryCtaUrl || '',
          hostIntro: show.siteSettings?.hostIntro || '',
          footerNote: show.siteSettings?.footerNote || '',
          themeVariant: show.siteSettings?.themeVariant || 'studio',
          customDomainHostname: show.customDomain?.hostname || '',
          customDomainStatus: show.customDomain?.status || 'not_configured',
          supportLinks: normalizeSupportLinks(show.monetization?.supportLinks || []),
          privateFeedOffer,
          privateFeedAccess,
          episodeCount: publicEpisodes.length,
          lastPublishedAt: publicEpisodes[0]?.publishedAt || show.lastPublishedAt,
          episodes: publicEpisodes,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function startPrivateFeedCheckout(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const listenerEmail = String(req.body.listenerEmail || '').trim().toLowerCase();
    const listenerName = String(req.body.listenerName || '').trim();
    const requestBaseUrl = buildRequestBaseUrl(req);
    const checkoutResult = await createPrivateFeedCheckoutSession({
      show,
      listenerEmail,
      listenerName,
      appUrl: requestBaseUrl,
    });

    if (checkoutResult.alreadyActive && checkoutResult.token) {
      if (req.session) {
        req.session.privateFeedAccess = buildPrivateFeedAccessSessionValue({
          show,
          token: checkoutResult.token,
          baseUrl: requestBaseUrl,
        });
      }
      req.flash('success', 'This premium feed is already active for that email.');
      return res.redirect('/podcasts/' + encodeURIComponent(show.slug));
    }

    return res.redirect(303, checkoutResult.session.url);
  } catch (error) {
    if (req.params.showSlug) {
      req.flash('error', error.message);
      return res.redirect('/podcasts/' + encodeURIComponent(req.params.showSlug));
    }

    return next(error);
  }
}

async function showPrivateFeedSubscribeSuccess(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const sessionId = String(req.query.session_id || '').trim();

    if (!sessionId) {
      throw new AppError('Missing Stripe session.', 400);
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const syncResult = await syncPrivateFeedEntitlementFromCheckoutSession(session, { show });

    if (!syncResult.synced || !syncResult.token) {
      throw new AppError('Unable to activate the private feed yet.', 400);
    }

    if (req.session) {
      req.session.privateFeedAccess = buildPrivateFeedAccessSessionValue({
        show,
        token: syncResult.token,
        baseUrl: buildRequestBaseUrl(req),
      });
    }

    req.flash('success', `Private feed unlocked for ${syncResult.token.subscriberEmail}.`);
    return res.redirect('/podcasts/' + encodeURIComponent(show.slug));
  } catch (error) {
    if (req.params.showSlug) {
      req.flash('error', error.message);
      return res.redirect('/podcasts/' + encodeURIComponent(req.params.showSlug));
    }

    return next(error);
  }
}

async function showPublishedEpisode(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const requestBaseUrl = buildRequestBaseUrl(req);
    await publishDueEpisodesForShow(show._id);

    const episode = await Episode.findOne({
      showId: show._id,
      publicSlug: String(req.params.episodeSlug || '').trim(),
      publishStatus: 'published',
      publicPageEnabled: true,
      publishedAt: { $lte: new Date() },
      $or: [
        { 'monetization.visibility': { $exists: false } },
        { 'monetization.visibility': 'public' },
      ],
    }).populate('audioAssetId');

    if (!episode) {
      throw new AppError('Published episode not found.', 404);
    }

    const summary = buildEpisodeSummary(episode) || 'Published episode from VicPods.';
    const episodeUrl = buildPublishedEpisodeUrl(show, episode, requestBaseUrl);

    return renderPage(res, {
      title: `${episode.title || 'Untitled episode'} - ${show.name}`,
      pageTitle: show.name,
      subtitle: 'Published episode',
      view: 'publish/episode',
      data: {
        publicShell: true,
        canonicalUrl: episodeUrl,
        metaDescription: summary,
        ogTitle: `${episode.title || 'Untitled episode'} - ${show.name}`,
        ogDescription: summary,
        ogType: 'article',
        ogImage: resolveShowCoverImageUrl(show, requestBaseUrl),
        publishedEpisode: formatPublishedEpisode({ show, episode, baseUrl: requestBaseUrl }),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function showEpisodeEmbed(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const requestBaseUrl = buildRequestBaseUrl(req);
    await publishDueEpisodesForShow(show._id);
    const episode = await Episode.findOne({
      showId: show._id,
      publicSlug: String(req.params.episodeSlug || '').trim(),
      publishStatus: 'published',
      publicPageEnabled: true,
      publishedAt: { $lte: new Date() },
    }).populate('audioAssetId');

    if (!episode) {
      throw new AppError('Published episode not found.', 404);
    }

    return res.render('publish/embed', {
      title: (episode.title || 'Untitled episode') + ' - ' + show.name,
      embedMode: 'episode',
      publishedShow: null,
      publishedEpisode: formatPublishedEpisode({ show, episode, baseUrl: requestBaseUrl }),
    });
  } catch (error) {
    return next(error);
  }
}

async function showPodcastEmbed(req, res, next) {
  try {
    const show = await getPublishedShowBySlug(req.params.showSlug);
    const requestBaseUrl = buildRequestBaseUrl(req);
    await publishDueEpisodesForShow(show._id);
    const episodes = await getPublishedEpisodes(show._id);

    return res.render('publish/embed', {
      title: show.name + ' - Podcast',
      embedMode: 'show',
      publishedShow: {
        name: show.name,
        description: show.description || 'A podcast published with VicPods.',
        coverImageUrl: resolveShowCoverImageUrl(show, requestBaseUrl),
        feedUrl: buildPodcastFeedUrl(show, requestBaseUrl),
        showUrl: buildPodcastShowUrl(show, requestBaseUrl),
        episodeCount: episodes.length,
      },
      publishedEpisode: episodes[0]
        ? formatPublishedEpisode({ show, episode: episodes[0], baseUrl: requestBaseUrl })
        : null,
    });
  } catch (error) {
    return next(error);
  }
}

async function showCustomDomainFeed(req, res, next) {
  const show = await getPublishedShowByHost(req);
  if (!show) {
    return next();
  }

  return sendPodcastFeedForShow(req, res, next, show);
}

async function showCustomDomainShow(req, res, next) {
  const show = await getPublishedShowByHost(req);
  if (!show) {
    return next();
  }

  req.params.showSlug = show.slug;
  return showPublishedShow(req, res, next);
}

async function showCustomDomainEpisode(req, res, next) {
  const show = await getPublishedShowByHost(req);
  if (!show) {
    return next();
  }

  req.params.showSlug = show.slug;
  return showPublishedEpisode(req, res, next);
}

async function showCustomDomainEmbed(req, res, next) {
  const show = await getPublishedShowByHost(req);
  if (!show) {
    return next();
  }

  req.params.showSlug = show.slug;
  return showPodcastEmbed(req, res, next);
}

async function showCustomDomainEpisodeEmbed(req, res, next) {
  const show = await getPublishedShowByHost(req);
  if (!show) {
    return next();
  }

  req.params.showSlug = show.slug;
  return showEpisodeEmbed(req, res, next);
}

module.exports = {
  showCustomDomainEmbed,
  showCustomDomainEpisode,
  showCustomDomainEpisodeEmbed,
  showCustomDomainFeed,
  showCustomDomainShow,
  showEpisodeEmbed,
  showPodcastFeed,
  showPrivatePodcastFeed,
  showPrivateFeedSubscribeSuccess,
  showPodcastEmbed,
  showPublishedShow,
  showPublishedEpisode,
  startPrivateFeedCheckout,
};
