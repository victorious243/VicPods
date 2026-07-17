const Episode = require('../models/Episode');
const PodcastShow = require('../models/PodcastShow');
const { buildPublicAudioUrl } = require('../services/publish/audioStorageService');
const { buildPodcastFeedXml } = require('../services/publish/rssFeedService');
const {
  buildEpisodeSummary,
  buildPodcastFeedUrl,
  buildPublishedEpisodeUrl,
  publishDueEpisodesForShow,
  resolveEpisodeExplicit,
  resolveShowCoverImageUrl,
  resolveShowWebsiteUrl,
} = require('../services/publish/publishService');
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
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate('audioAssetId');

    const feedXml = buildPodcastFeedXml({ show, episodes, baseUrl: requestBaseUrl });

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(feedXml);
  } catch (error) {
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
    }).populate('audioAssetId');

    if (!episode) {
      throw new AppError('Published episode not found.', 404);
    }

    const summary = buildEpisodeSummary(episode) || 'Published episode from VicPods.';
    const episodeUrl = buildPublishedEpisodeUrl(show, episode, requestBaseUrl);
    const feedUrl = buildPodcastFeedUrl(show, requestBaseUrl);

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
        publishedEpisode: {
          title: episode.title || 'Untitled episode',
          summary,
          description: episode.launchPack?.showNotes || episode.launchPack?.description || summary,
          publishedAt: episode.publishedAt,
          durationLabel: formatDurationLabel(episode.durationSeconds || episode.audioAssetId?.durationSeconds),
          explicit: resolveEpisodeExplicit(episode, show),
          audioUrl: buildPublicAudioUrl(episode.audioAssetId, requestBaseUrl),
          coverImageUrl: resolveShowCoverImageUrl(show, requestBaseUrl),
          showName: show.name,
          showDescription: show.description,
          showAuthor: show.authorName || show.name,
          showWebsiteUrl: resolveShowWebsiteUrl(show, requestBaseUrl),
          feedUrl,
          outline: Array.isArray(episode.outline) ? episode.outline.filter(Boolean) : [],
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showPodcastFeed,
  showPublishedEpisode,
};
