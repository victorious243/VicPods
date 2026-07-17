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
  buildEpisodeSummary,
  buildPodcastFeedUrl,
  buildPublishedEpisodeUrl,
  generateUniqueEpisodeSlug,
  generateUniqueShowSlug,
  normalizeText,
  syncPodcastShowStats,
} = require('../services/publish/publishService');
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

function parseExplicitSetting(value) {
  if (value === 'yes') {
    return true;
  }

  if (value === 'no') {
    return false;
  }

  return null;
}

function buildShowDefaults(req) {
  return {
    authorName: clampText(req.currentUser?.name || '', 120),
    ownerEmail: clampText(req.currentUser?.email || '', 200),
    language: PODCAST_LANGUAGE_BY_APP_LANGUAGE[req.language] || 'en-us',
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

async function listShows(req, res, next) {
  try {
    const podcastShows = await PodcastShow.find({ userId: req.currentUser._id }).sort({ updatedAt: -1 });
    const requestBaseUrl = buildRequestBaseUrl(req);

    return renderPage(res, {
      title: 'Hosted Shows - VicPods',
      pageTitle: 'Hosted Shows',
      subtitle: 'Create one feed, connect final audio, and publish Ready episodes from inside the editor.',
      view: 'publish/shows',
      data: {
        podcastShows,
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
      websiteUrl: clampText(req.body.websiteUrl, 500),
      copyright: clampText(req.body.copyright, 240),
      explicit: req.body.explicit === 'yes',
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
      durationSeconds,
      bitrateKbps,
      status: 'ready',
      processedAt: storedAudio.processedAt,
    });

    episode.audioAssetId = createdAsset._id;
    episode.durationSeconds = durationSeconds || episode.durationSeconds;
    await episode.save();

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
        durationSeconds: createdAsset.durationSeconds,
        bitrateKbps: createdAsset.bitrateKbps,
        publicUrl: buildPublicAudioUrl(createdAsset, requestBaseUrl),
        publicPath: buildPublicAudioPath(createdAsset.storageKey),
      },
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
  listShows,
  updateEpisodePublication,
  uploadEpisodeAudio,
};
