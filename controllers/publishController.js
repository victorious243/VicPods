const AudioAsset = require('../models/AudioAsset');
const Episode = require('../models/Episode');
const PodcastShow = require('../models/PodcastShow');
const {
  buildPublicAudioPath,
  buildPublicAudioUrl,
  removeStoredAudioFile,
  storeEpisodeAudioFile,
} = require('../services/publish/audioStorageService');
const {
  queueWebhookDeliveries,
} = require('../services/integrations/advancedMediaIntegrationService');
const {
  kickWebhookDeliveryWorker,
} = require('../services/integrations/webhookDeliveryWorkerService');
const {
  enqueueAudioMetadataJob,
  kickMediaJobWorker,
} = require('../services/media/mediaJobWorkerService');
const { storeShowCoverFile } = require('../services/publish/coverStorageService');
const {
  DIRECTORY_PLATFORM_KEYS,
  buildDirectoryChecklist,
} = require('../services/publish/directoryChecklistService');
const { buildFeedValidation } = require('../services/publish/feedValidationService');
const {
  buildEpisodeSummary,
  buildPodcastFeedUrl,
  buildPodcastShowUrl,
  buildPublishedEpisodeUrl,
  generateUniqueEpisodeSlug,
  generateUniqueShowSlug,
  normalizeDomainHostname,
  normalizeText,
  syncPodcastShowStats,
} = require('../services/publish/publishService');
const { importPodcastFeed } = require('../services/publish/podcastImportService');
const { AppError } = require('../utils/errors');
const { episodeEditorPath, podcastShowsPath } = require('../utils/paths');
const { buildRequestBaseUrl } = require('../utils/requestUrl');
const { renderPage } = require('../utils/render');

const READY_TO_PUBLISH_STATUSES = new Set(['Ready', 'Served']);
const PODCAST_LANGUAGE_BY_APP_LANGUAGE = {
  en: 'en-us',
  es: 'es-es',
  pt: 'pt-pt',
};

function clampText(value, maxLength) {
  return normalizeText(value).slice(0, maxLength);
}

function parseOptionalPositiveInteger(value) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDateTimeInput(value) {
  if (!String(value || '').trim()) {
    return null;
  }

  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDateInput(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isHttpUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function cleanOptionalUrl(value, maxLength = 500) {
  const normalized = clampText(value, maxLength);
  return normalized && isHttpUrl(normalized) ? normalized : '';
}

function normalizeThemeVariant(value) {
  const variant = String(value || '').trim();
  return ['studio', 'signal', 'sunrise', 'forest'].includes(variant) ? variant : 'studio';
}

function normalizeCustomDomainStatus(value, hostname) {
  if (!hostname) {
    return 'not_configured';
  }

  const status = String(value || '').trim();
  return ['pending_verification', 'active'].includes(status) ? status : 'pending_verification';
}

function normalizeDirectorySubmissionStatus(value) {
  const status = String(value || '').trim();
  return ['not_started', 'submitted', 'listed', 'needs_attention'].includes(status)
    ? status
    : 'not_started';
}

function parseExplicitSetting(value) {
  if (value === 'yes') {
    return true;
  }

  if (value === 'no') {
    return false;
  }

  return null;
}

function parseEpisodeVisibility(value) {
  const visibility = String(value || 'public').trim();
  return ['public', 'premium', 'private'].includes(visibility) ? visibility : 'public';
}

function parseAdSlots(body) {
  const positions = Array.isArray(body.adSlotPosition) ? body.adSlotPosition : [body.adSlotPosition];
  const timestamps = Array.isArray(body.adSlotTimestampSeconds) ? body.adSlotTimestampSeconds : [body.adSlotTimestampSeconds];
  const sponsors = Array.isArray(body.adSlotSponsorName) ? body.adSlotSponsorName : [body.adSlotSponsorName];
  const statuses = Array.isArray(body.adSlotStatus) ? body.adSlotStatus : [body.adSlotStatus];
  const copyItems = Array.isArray(body.adSlotCopy) ? body.adSlotCopy : [body.adSlotCopy];

  return positions
    .map((position, index) => ({
      position: ['pre_roll', 'mid_roll', 'post_roll'].includes(position) ? position : 'mid_roll',
      timestampSeconds: parseOptionalPositiveInteger(timestamps[index]),
      sponsorName: clampText(sponsors[index], 160),
      status: ['planned', 'sold', 'delivered'].includes(statuses[index]) ? statuses[index] : 'planned',
      copy: clampText(copyItems[index], 1000),
    }))
    .filter((slot) => slot.sponsorName || slot.copy || slot.status !== 'planned')
    .slice(0, 6);
}

function buildShowDefaults(req) {
  return {
    authorName: clampText(req.currentUser?.name || '', 120),
    ownerEmail: clampText(req.currentUser?.email || '', 200),
    language: PODCAST_LANGUAGE_BY_APP_LANGUAGE[req.language] || 'en-us',
  };
}

function buildShowWebsiteSettingsInput(body = {}, currentShow = null) {
  const hostname = normalizeDomainHostname(body.customDomainHostname);
  const currentHostname = normalizeDomainHostname(currentShow?.customDomain?.hostname);
  const hostnameChanged = hostname !== currentHostname;
  const customDomainStatus = hostnameChanged
    ? normalizeCustomDomainStatus('pending_verification', hostname)
    : normalizeCustomDomainStatus(body.customDomainStatus, hostname);
  const currentStatus = currentShow?.customDomain?.status || 'not_configured';
  const statusChanged = customDomainStatus !== currentStatus;

  return {
    description: clampText(body.description, 4000),
    authorName: clampText(body.authorName, 120),
    ownerEmail: clampText(body.ownerEmail, 200).toLowerCase(),
    language: clampText(body.language, 20).toLowerCase(),
    categoryPrimary: clampText(body.categoryPrimary, 120),
    categorySecondary: clampText(body.categorySecondary, 120),
    websiteUrl: cleanOptionalUrl(body.websiteUrl, 500),
    copyright: clampText(body.copyright, 240),
    explicit: body.explicit === 'yes',
    siteSettings: {
      heroLabel: clampText(body.heroLabel, 80),
      heroTagline: clampText(body.heroTagline, 240),
      featuredLabel: clampText(body.featuredLabel, 80),
      featuredText: clampText(body.featuredText, 320),
      primaryCtaLabel: clampText(body.primaryCtaLabel, 80),
      primaryCtaUrl: cleanOptionalUrl(body.primaryCtaUrl, 500),
      hostIntro: clampText(body.hostIntro, 500),
      footerNote: clampText(body.footerNote, 240),
      themeVariant: normalizeThemeVariant(body.themeVariant),
    },
    customDomain: {
      hostname,
      status: customDomainStatus,
      dnsTarget: 'connect.vicpods.app',
      verifiedAt: customDomainStatus === 'active'
        ? (statusChanged ? new Date() : currentShow?.customDomain?.verifiedAt || new Date())
        : null,
      lastCheckedAt: hostname ? new Date() : null,
      verificationToken: currentShow?.customDomain?.verificationToken || undefined,
    },
  };
}

function redirectToEpisodeEditor(res, episode) {
  return res.redirect(episodeEditorPath({
    seriesId: episode.seriesId,
    themeId: episode.themeId,
    episodeId: episode._id,
  }));
}

async function getOwnedEpisode(userId, episodeId) {
  const episode = await Episode.findOne({
    _id: episodeId,
    userId,
  }).populate('audioAssetId');

  if (!episode) {
    throw new AppError('Episode not found.', 404);
  }

  return episode;
}

async function ensureCustomDomainAvailable({ showId, hostname }) {
  const normalizedHostname = normalizeDomainHostname(hostname);
  if (!normalizedHostname) {
    return;
  }

  const existingShow = await PodcastShow.findOne({
    _id: { $ne: showId },
    'customDomain.hostname': normalizedHostname,
  }).select('_id name');

  if (existingShow) {
    throw new AppError(`The custom domain ${normalizedHostname} is already attached to another hosted show.`, 400);
  }
}

function upsertDirectorySubmission(show, platformKey, nextEntry) {
  const currentEntries = Array.isArray(show.directorySubmissions)
    ? show.directorySubmissions.map((entry) => (typeof entry.toObject === 'function' ? entry.toObject() : { ...entry }))
    : [];
  const existingIndex = currentEntries.findIndex((entry) => entry.platformKey === platformKey);

  if (existingIndex >= 0) {
    currentEntries[existingIndex] = {
      ...currentEntries[existingIndex],
      ...nextEntry,
    };
  } else {
    currentEntries.push({
      platformKey,
      ...nextEntry,
    });
  }

  show.directorySubmissions = currentEntries;
}

async function listShows(req, res, next) {
  try {
    const podcastShows = await PodcastShow.find({ userId: req.currentUser._id }).sort({ updatedAt: -1 });
    const requestBaseUrl = buildRequestBaseUrl(req);
    const podcastShowDetails = await Promise.all(podcastShows.map(async (show) => {
      const episodes = await Episode.find({
        userId: req.currentUser._id,
        showId: show._id,
        publicPageEnabled: true,
        publishStatus: { $in: ['published', 'scheduled'] },
      })
        .sort({ publishedAt: -1, scheduledFor: 1, createdAt: -1 })
        .populate('audioAssetId')
        .limit(12);
      const feedValidation = buildFeedValidation({ show, episodes, baseUrl: requestBaseUrl });
      const feedUrl = buildPodcastFeedUrl(show, requestBaseUrl);
      const showUrl = buildPodcastShowUrl(show, requestBaseUrl);

      return {
        show,
        episodes,
        feedValidation,
        directoryChecklist: buildDirectoryChecklist({ feedValidation, feedUrl, show }),
        feedUrl,
        showUrl,
        embedUrl: showUrl + '/embed',
      };
    }));

    return renderPage(res, {
      title: 'Hosted Shows - VicPods',
      pageTitle: 'Hosted Shows',
      subtitle: 'Create one feed, connect final audio, and publish Ready episodes from inside the editor.',
      view: 'publish/shows',
      data: {
        podcastShows,
        podcastShowDetails,
        defaultShowValues: buildShowDefaults(req),
        podcastFeedUrls: Object.fromEntries(
          podcastShows.map((show) => [String(show._id), buildPodcastFeedUrl(show, requestBaseUrl)])
        ),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function uploadShowCover(req, res) {
  try {
    const show = await PodcastShow.findOne({
      _id: req.params.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      throw new AppError('Hosted show not found.', 404);
    }

    const requestBaseUrl = buildRequestBaseUrl(req);
    const storedCover = await storeShowCoverFile({
      userId: req.currentUser._id,
      showId: show._id,
      coverDataUrl: req.body.coverDataUrl,
    });

    show.coverImageUrl = requestBaseUrl.replace(/\/$/, '') + storedCover.publicPath;
    await show.save();

    return res.status(201).json({
      message: 'Cover artwork uploaded.',
      coverImageUrl: show.coverImageUrl,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Unable to upload cover artwork right now.',
    });
  }
}

async function createShow(req, res, next) {
  try {
    const name = clampText(req.body.name, 120);

    if (!name) {
      throw new AppError('Show name is required.', 400);
    }

    const slug = await generateUniqueShowSlug(name);

    await PodcastShow.create({
      userId: req.currentUser._id,
      name,
      slug,
      description: clampText(req.body.description, 4000),
      authorName: clampText(req.body.authorName || req.currentUser?.name, 120),
      ownerEmail: clampText(req.body.ownerEmail || req.currentUser?.email, 200).toLowerCase(),
      language: clampText(req.body.language || buildShowDefaults(req).language, 20).toLowerCase(),
      categoryPrimary: clampText(req.body.categoryPrimary, 120),
      categorySecondary: clampText(req.body.categorySecondary, 120),
      coverImageUrl: clampText(req.body.coverImageUrl, 500),
      websiteUrl: cleanOptionalUrl(req.body.websiteUrl, 500),
      copyright: clampText(req.body.copyright, 240),
      explicit: req.body.explicit === 'yes',
      siteSettings: {
        heroLabel: 'Live podcast channel',
        heroTagline: '',
        featuredLabel: '',
        featuredText: '',
        primaryCtaLabel: '',
        primaryCtaUrl: '',
        hostIntro: '',
        footerNote: '',
        themeVariant: 'studio',
      },
    });

    req.flash('success', 'Hosted show created.');
    return res.redirect(podcastShowsPath());
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(podcastShowsPath());
    }

    return next(error);
  }
}

async function updateShowSettings(req, res, next) {
  try {
    const show = await PodcastShow.findOne({
      _id: req.params.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      throw new AppError('Hosted show not found.', 404);
    }

    const input = buildShowWebsiteSettingsInput({
      ...req.body,
      authorName: req.body.authorName || show.authorName || req.currentUser?.name,
      ownerEmail: req.body.ownerEmail || show.ownerEmail || req.currentUser?.email,
      language: req.body.language || show.language || buildShowDefaults(req).language,
    }, show);

    await ensureCustomDomainAvailable({
      showId: show._id,
      hostname: input.customDomain.hostname,
    });

    show.description = input.description;
    show.authorName = input.authorName;
    show.ownerEmail = input.ownerEmail;
    show.language = input.language;
    show.categoryPrimary = input.categoryPrimary;
    show.categorySecondary = input.categorySecondary;
    show.websiteUrl = input.websiteUrl;
    show.copyright = input.copyright;
    show.explicit = input.explicit;
    show.siteSettings = {
      ...(show.siteSettings?.toObject ? show.siteSettings.toObject() : show.siteSettings || {}),
      ...input.siteSettings,
    };
    show.customDomain = {
      ...(show.customDomain?.toObject ? show.customDomain.toObject() : show.customDomain || {}),
      ...input.customDomain,
      verificationError: input.customDomain.hostname
        ? (
            input.customDomain.status === 'active'
              ? ''
              : `Point ${input.customDomain.hostname} to ${input.customDomain.dnsTarget}, then verify from that domain.`
          )
        : '',
    };

    await show.save();

    req.flash('success', 'Hosted show settings saved.');
    return res.redirect(podcastShowsPath());
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(podcastShowsPath());
    }

    return next(error);
  }
}

async function importShowFromFeed(req, res, next) {
  try {
    const result = await importPodcastFeed({
      userId: req.currentUser._id,
      rssXml: req.body.rssXml,
      rssDataUrl: req.body.rssDataUrl,
      sourceUrl: req.body.sourceUrl,
    });

    req.flash(
      'success',
      `${result.createdShow ? 'Imported' : 'Updated'} ${result.show.name}: ${result.createdEpisodes} created, ${result.updatedEpisodes} updated, ${result.importedPublishedCount} published.`
    );
    return res.redirect(podcastShowsPath());
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(podcastShowsPath());
    }

    return next(error);
  }
}

async function verifyShowCustomDomain(req, res, next) {
  try {
    const show = await PodcastShow.findOne({
      _id: req.params.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      throw new AppError('Hosted show not found.', 404);
    }

    const hostname = normalizeDomainHostname(show.customDomain?.hostname);
    if (!hostname) {
      throw new AppError('Add a custom domain before verifying it.', 400);
    }

    await ensureCustomDomainAvailable({
      showId: show._id,
      hostname,
    });

    const requestHost = normalizeDomainHostname(req.get('x-forwarded-host') || req.get('host') || '');
    show.customDomain.lastCheckedAt = new Date();

    if (requestHost === hostname) {
      show.customDomain.status = 'active';
      show.customDomain.verifiedAt = new Date();
      show.customDomain.verificationError = '';
      await show.save();
      req.flash('success', `Custom domain ${hostname} is now active.`);
      return res.redirect(podcastShowsPath());
    }

    show.customDomain.status = 'pending_verification';
    show.customDomain.verificationError = `Waiting for requests on ${hostname}. Point the domain to ${show.customDomain.dnsTarget} and open the site from that hostname before verifying again.`;
    await show.save();

    req.flash('error', `Custom domain is still pending. Open the show from ${hostname} after DNS points to ${show.customDomain.dnsTarget}.`);
    return res.redirect(podcastShowsPath());
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(podcastShowsPath());
    }

    return next(error);
  }
}

async function updateShowDirectorySubmission(req, res, next) {
  try {
    const show = await PodcastShow.findOne({
      _id: req.params.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      throw new AppError('Hosted show not found.', 404);
    }

    const platformKey = String(req.params.platformKey || '').trim();
    if (!DIRECTORY_PLATFORM_KEYS.has(platformKey)) {
      throw new AppError('Directory platform not supported.', 400);
    }

    const status = normalizeDirectorySubmissionStatus(req.body.status);
    const submittedAt = parseDateInput(req.body.submittedAt);
    const listedAt = parseDateInput(req.body.listedAt);
    const nextEntry = {
      platformKey,
      status,
      submittedAt: status === 'submitted' || status === 'listed'
        ? (submittedAt || new Date())
        : null,
      listedAt: status === 'listed'
        ? (listedAt || new Date())
        : null,
      listingUrl: cleanOptionalUrl(req.body.listingUrl, 500),
      notes: clampText(req.body.notes, 500),
      lastCheckedAt: new Date(),
    };

    if (status === 'not_started') {
      nextEntry.submittedAt = null;
      nextEntry.listedAt = null;
      nextEntry.listingUrl = '';
      nextEntry.notes = '';
    }

    upsertDirectorySubmission(show, platformKey, nextEntry);
    await show.save();

    req.flash('success', 'Directory tracking updated.');
    return res.redirect(podcastShowsPath());
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(podcastShowsPath());
    }

    return next(error);
  }
}

async function uploadEpisodeAudio(req, res) {
  try {
    const episode = await getOwnedEpisode(req.currentUser._id, req.params.episodeId);
    const requestBaseUrl = buildRequestBaseUrl(req);
    const previousAsset = episode.audioAssetId
      ? await AudioAsset.findOne({
          _id: episode.audioAssetId._id || episode.audioAssetId,
          userId: req.currentUser._id,
        })
      : null;
    const storedAudio = await storeEpisodeAudioFile({
      userId: req.currentUser._id,
      episodeId: episode._id,
      originalFilename: req.body.originalFilename,
      mimeType: req.body.mimeType,
      audioDataUrl: req.body.audioDataUrl,
    });
    const durationSeconds = parseOptionalPositiveInteger(req.body.durationSeconds);
    const bitrateKbps = parseOptionalPositiveInteger(req.body.bitrateKbps);
    const createdAsset = await AudioAsset.create({
      userId: req.currentUser._id,
      episodeId: episode._id,
      storageProvider: storedAudio.storageProvider,
      storageKey: storedAudio.storageKey,
      originalFilename: storedAudio.originalFilename,
      mimeType: storedAudio.mimeType,
      byteSize: storedAudio.byteSize,
      metadataStatus: durationSeconds && bitrateKbps ? 'ready' : 'pending',
      durationSeconds,
      bitrateKbps,
      status: 'ready',
      processedAt: storedAudio.processedAt,
    });

    episode.audioAssetId = createdAsset._id;
    episode.durationSeconds = durationSeconds || episode.durationSeconds;
    await episode.save();

    let metadataJob = null;
    try {
      metadataJob = await enqueueAudioMetadataJob({
        userId: req.currentUser._id,
        episodeId: episode._id,
        audioAsset: createdAsset,
      });
      kickMediaJobWorker(console);
    } catch (error) {
      createdAsset.metadataStatus = 'failed';
      await createdAsset.save();
      // eslint-disable-next-line no-console
      console.error(`Audio metadata queue failed for ${createdAsset._id}: ${error.message}`);
    }

    if (previousAsset) {
      previousAsset.status = 'replaced';
      await previousAsset.save();

      try {
        await removeStoredAudioFile(previousAsset.storageKey);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Old audio cleanup failed for ${previousAsset._id}: ${error.message}`);
      }
    }

    return res.status(201).json({
      message: 'MP3 uploaded.',
      asset: {
        id: createdAsset._id,
        originalFilename: createdAsset.originalFilename,
        mimeType: createdAsset.mimeType,
        byteSize: createdAsset.byteSize,
        metadataStatus: createdAsset.metadataStatus,
        durationSeconds: createdAsset.durationSeconds,
        bitrateKbps: createdAsset.bitrateKbps,
        publicUrl: buildPublicAudioUrl(createdAsset, requestBaseUrl),
        publicPath: buildPublicAudioPath(createdAsset.storageKey),
      },
      job: metadataJob
        ? {
            id: metadataJob._id,
            jobType: metadataJob.jobType,
            status: metadataJob.status,
          }
        : null,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Unable to upload audio right now.',
    });
  }
}

async function updateEpisodePublication(req, res, next) {
  try {
    const episode = await getOwnedEpisode(req.currentUser._id, req.params.episodeId);
    const publicationAction = String(req.body.publicationAction || 'save').trim();
    const previousShowId = episode.showId ? String(episode.showId._id || episode.showId) : '';
    const showIdsToSync = new Set();

    if (publicationAction === 'unpublish') {
      episode.publishStatus = 'draft';
      episode.publicPageEnabled = false;
      episode.publishedAt = null;
      episode.scheduledFor = null;
      await episode.save();

      if (previousShowId) {
        showIdsToSync.add(previousShowId);
      }

      await Promise.all(Array.from(showIdsToSync).map((showId) => syncPodcastShowStats(showId)));

      req.flash('success', 'Episode removed from the public feed.');
      return redirectToEpisodeEditor(res, episode);
    }

    const show = await PodcastShow.findOne({
      _id: req.body.showId,
      userId: req.currentUser._id,
    });

    if (!show) {
      throw new AppError('Choose a hosted show before publishing.', 400);
    }

    const requestedPublishAt = parseDateTimeInput(req.body.scheduledFor);
    if (String(req.body.scheduledFor || '').trim() && !requestedPublishAt) {
      throw new AppError('Publish date is invalid.', 400);
    }

    episode.showId = show._id;
    episode.summary = clampText(req.body.summary, 3000) || buildEpisodeSummary(episode);
    episode.seasonNumber = parseOptionalPositiveInteger(req.body.seasonNumber);
    episode.episodeNumberForFeed = parseOptionalPositiveInteger(req.body.episodeNumberForFeed)
      || episode.episodeNumberForFeed
      || episode.globalEpisodeNumber
      || episode.episodeNumberWithinTheme;
    episode.explicit = parseExplicitSetting(req.body.explicitSetting);
    episode.monetization = {
      ...(episode.monetization?.toObject ? episode.monetization.toObject() : episode.monetization || {}),
      visibility: parseEpisodeVisibility(req.body.monetizationVisibility),
      supportLinkOverride: clampText(req.body.supportLinkOverride, 500),
      sponsorName: clampText(req.body.sponsorName, 160),
      sponsorCampaign: clampText(req.body.sponsorCampaign, 160),
      adSlots: parseAdSlots(req.body),
    };
    episode.publicSlug = await generateUniqueEpisodeSlug({
      showId: show._id,
      episodeId: episode._id,
      title: req.body.publicSlug || episode.title || `episode-${episode.episodeNumberWithinTheme}`,
      fallbackNumber: episode.globalEpisodeNumber || episode.episodeNumberWithinTheme,
    });

    if (publicationAction === 'save') {
      episode.scheduledFor = requestedPublishAt;
      await episode.save();

      if (previousShowId && previousShowId !== String(show._id)) {
        showIdsToSync.add(previousShowId);
      }
      if (episode.publishStatus === 'published') {
        showIdsToSync.add(String(show._id));
      }

      await Promise.all(Array.from(showIdsToSync).map((showId) => syncPodcastShowStats(showId)));

      req.flash('success', 'Publish setup saved.');
      return redirectToEpisodeEditor(res, episode);
    }

    if (!READY_TO_PUBLISH_STATUSES.has(episode.status)) {
      throw new AppError('Move the episode to Ready before publishing it live.', 400);
    }

    if (!episode.audioAssetId) {
      throw new AppError('Upload the final MP3 before publishing.', 400);
    }

    if (!episode.title) {
      throw new AppError('Add an episode title before publishing.', 400);
    }

    if (!episode.summary) {
      throw new AppError('Add a publish summary before publishing.', 400);
    }

    if (!episode.rssGuid) {
      episode.rssGuid = `vicpods:${episode._id}`;
    }

    episode.publicPageEnabled = true;

    if (requestedPublishAt && requestedPublishAt.getTime() > Date.now()) {
      episode.publishStatus = 'scheduled';
      episode.scheduledFor = requestedPublishAt;
      episode.publishedAt = null;
      await episode.save();

      if (previousShowId && previousShowId !== String(show._id)) {
        showIdsToSync.add(previousShowId);
      }
      showIdsToSync.add(String(show._id));
      await Promise.all(Array.from(showIdsToSync).map((showId) => syncPodcastShowStats(showId)));

      await queueWebhookDeliveries({
        userId: req.currentUser._id,
        eventType: 'episode.scheduled',
        episode,
        show,
        baseUrl: buildRequestBaseUrl(req),
        metadata: {
          scheduledFor: requestedPublishAt.toISOString(),
        },
      });
      kickWebhookDeliveryWorker(console);

      req.flash('success', `Episode scheduled for ${requestedPublishAt.toLocaleString()}.`);
      return redirectToEpisodeEditor(res, episode);
    }

    episode.publishStatus = 'published';
    episode.publishedAt = requestedPublishAt || episode.publishedAt || new Date();
    episode.scheduledFor = null;
    await episode.save();

    if (previousShowId && previousShowId !== String(show._id)) {
      showIdsToSync.add(previousShowId);
    }
    showIdsToSync.add(String(show._id));
    await Promise.all(Array.from(showIdsToSync).map((showId) => syncPodcastShowStats(showId)));

    await queueWebhookDeliveries({
      userId: req.currentUser._id,
      eventType: 'episode.published',
      episode,
      show,
      baseUrl: buildRequestBaseUrl(req),
      metadata: {
        publishedAt: (episode.publishedAt || new Date()).toISOString(),
      },
    });
    kickWebhookDeliveryWorker(console);

    req.flash('success', 'Episode is live and included in the podcast feed.');
    return redirectToEpisodeEditor(res, episode);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);

      try {
        const episode = await getOwnedEpisode(req.currentUser._id, req.params.episodeId);
        return redirectToEpisodeEditor(res, episode);
      } catch (redirectError) {
        return res.redirect('/kitchen');
      }
    }

    return next(error);
  }
}

module.exports = {
  createShow,
  importShowFromFeed,
  listShows,
  updateEpisodePublication,
  updateShowDirectorySubmission,
  updateShowSettings,
  uploadShowCover,
  uploadEpisodeAudio,
  verifyShowCustomDomain,
};
