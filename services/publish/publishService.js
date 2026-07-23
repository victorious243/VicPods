const mongoose = require('mongoose');
const Episode = require('../../models/Episode');
const PodcastShow = require('../../models/PodcastShow');
const { buildAbsoluteUrl, buildDefaultSocialImageUrl, normalizeAppUrl } = require('../seo/siteSeoService');

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSlugSource(value) {
  return normalizeText(value)
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ø/gi, 'o')
    .replace(/đ/gi, 'd')
    .replace(/ł/gi, 'l')
    .replace(/þ/gi, 'th');
}

function slugifySegment(value, fallback = 'item') {
  const normalized = normalizeSlugSource(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  return normalized || fallback;
}

async function generateUniqueShowSlug(name, excludeId = null) {
  const baseSlug = slugifySegment(name, 'show');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await PodcastShow.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select('_id');

    if (!existing) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

async function generateUniqueEpisodeSlug({
  showId,
  episodeId,
  title,
  fallbackNumber,
}) {
  const fallback = fallbackNumber ? `episode-${fallbackNumber}` : 'episode';
  const baseSlug = slugifySegment(title, fallback);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await Episode.findOne({
      showId,
      publicSlug: candidate,
      ...(episodeId ? { _id: { $ne: episodeId } } : {}),
    }).select('_id');

    if (!existing) {
      return candidate;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

function buildPodcastShowPath(showOrSlug) {
  const slug = typeof showOrSlug === 'string' ? showOrSlug : showOrSlug?.slug;
  return `/podcasts/${slug}`;
}

function normalizeDomainHostname(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');
}

function resolveShowBaseUrl(show, fallbackBaseUrl) {
  const customDomain = normalizeDomainHostname(show?.customDomain?.hostname);
  if (customDomain && show?.customDomain?.status === 'active') {
    const fallback = normalizeAppUrl(fallbackBaseUrl);
    const protocolMatch = fallback.match(/^(https?):\/\//i);
    const protocol = protocolMatch ? protocolMatch[1].toLowerCase() : 'https';
    return `${protocol}://${customDomain}`;
  }

  return normalizeAppUrl(fallbackBaseUrl);
}

function buildPodcastFeedPath(showOrSlug) {
  return `${buildPodcastShowPath(showOrSlug)}/feed.xml`;
}

function buildPublishedEpisodePath(showOrSlug, episodeOrSlug) {
  const showSlug = typeof showOrSlug === 'string' ? showOrSlug : showOrSlug?.slug;
  const episodeSlug = typeof episodeOrSlug === 'string' ? episodeOrSlug : episodeOrSlug?.publicSlug;
  return `/podcasts/${showSlug}/${episodeSlug}`;
}

function buildPodcastFeedUrl(showOrSlug, baseUrl) {
  const resolvedBaseUrl = typeof showOrSlug === 'string'
    ? baseUrl
    : resolveShowBaseUrl(showOrSlug, baseUrl);
  return buildAbsoluteUrl(buildPodcastFeedPath(showOrSlug), resolvedBaseUrl);
}

function buildPublishedEpisodeUrl(showOrSlug, episodeOrSlug, baseUrl) {
  const resolvedBaseUrl = typeof showOrSlug === 'string'
    ? baseUrl
    : resolveShowBaseUrl(showOrSlug, baseUrl);
  return buildAbsoluteUrl(buildPublishedEpisodePath(showOrSlug, episodeOrSlug), resolvedBaseUrl);
}

function buildPodcastShowUrl(showOrSlug, baseUrl) {
  const resolvedBaseUrl = typeof showOrSlug === 'string'
    ? baseUrl
    : resolveShowBaseUrl(showOrSlug, baseUrl);
  return buildAbsoluteUrl(buildPodcastShowPath(showOrSlug), resolvedBaseUrl);
}

function buildEpisodeSummary(episode) {
  return normalizeText(
    episode?.summary
    || episode?.launchPack?.description
    || episode?.showNotesPack?.summary
    || episode?.hook
  );
}

function resolveShowCoverImageUrl(show, baseUrl) {
  return normalizeText(show?.coverImageUrl) || buildDefaultSocialImageUrl(baseUrl);
}

function resolveShowWebsiteUrl(show, baseUrl) {
  return normalizeText(show?.websiteUrl) || buildPodcastShowUrl(show, baseUrl);
}

function resolveEpisodeExplicit(episode, show) {
  if (typeof episode?.explicit === 'boolean') {
    return episode.explicit;
  }

  return Boolean(show?.explicit);
}

async function syncPodcastShowStats(showId) {
  if (!showId) {
    return null;
  }

  const normalizedShowId = showId instanceof mongoose.Types.ObjectId
    ? showId
    : new mongoose.Types.ObjectId(String(showId));
  const [stats] = await Episode.aggregate([
    {
      $match: {
        showId: normalizedShowId,
        publishStatus: 'published',
        publicPageEnabled: true,
      },
    },
    {
      $group: {
        _id: '$showId',
        publishedEpisodeCount: { $sum: 1 },
        lastPublishedAt: { $max: '$publishedAt' },
      },
    },
  ]);

  const update = stats
    ? {
        publishedEpisodeCount: stats.publishedEpisodeCount,
        lastPublishedAt: stats.lastPublishedAt || null,
        feedStatus: stats.publishedEpisodeCount > 0 ? 'live' : 'draft',
      }
    : {
        publishedEpisodeCount: 0,
        lastPublishedAt: null,
        feedStatus: 'draft',
      };

  return PodcastShow.findByIdAndUpdate(normalizedShowId, { $set: update }, { returnDocument: 'after' });
}

async function publishDueEpisodesForShow(showId, now = new Date()) {
  if (!showId) {
    return 0;
  }

  const dueEpisodes = await Episode.find({
    showId,
    publishStatus: 'scheduled',
    publicPageEnabled: true,
    scheduledFor: { $lte: now },
  }).select('_id scheduledFor publishedAt');

  if (!dueEpisodes.length) {
    return 0;
  }

  await Promise.all(dueEpisodes.map((episode) => {
    episode.publishStatus = 'published';
    episode.publishedAt = episode.publishedAt || episode.scheduledFor || now;
    return episode.save();
  }));

  await syncPodcastShowStats(showId);
  return dueEpisodes.length;
}

module.exports = {
  buildEpisodeSummary,
  buildPodcastFeedPath,
  buildPodcastFeedUrl,
  buildPodcastShowUrl,
  buildPodcastShowPath,
  buildPublishedEpisodePath,
  buildPublishedEpisodeUrl,
  generateUniqueEpisodeSlug,
  generateUniqueShowSlug,
  normalizeText,
  normalizeDomainHostname,
  publishDueEpisodesForShow,
  resolveEpisodeExplicit,
  resolveShowBaseUrl,
  resolveShowCoverImageUrl,
  resolveShowWebsiteUrl,
  slugifySegment,
  syncPodcastShowStats,
};
