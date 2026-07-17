const { buildPublicAudioUrl } = require('./audioStorageService');
const {
  buildEpisodeSummary,
  buildPodcastFeedUrl,
  buildPublishedEpisodeUrl,
  resolveEpisodeExplicit,
  resolveShowCoverImageUrl,
  resolveShowWebsiteUrl,
} = require('./publishService');

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapCdata(value) {
  return `<![CDATA[${String(value || '').replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function formatPubDate(value) {
  return new Date(value).toUTCString();
}

function formatDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return '';
  }

  const totalSeconds = Math.round(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function buildCategoryXml(show) {
  if (!show?.categoryPrimary) {
    return '';
  }

  if (!show.categorySecondary) {
    return `<itunes:category text="${escapeXml(show.categoryPrimary)}" />`;
  }

  return [
    `<itunes:category text="${escapeXml(show.categoryPrimary)}">`,
    `<itunes:category text="${escapeXml(show.categorySecondary)}" />`,
    '</itunes:category>',
  ].join('');
}

function buildItemXml(show, episode, baseUrl) {
  const summary = buildEpisodeSummary(episode) || episode.title || 'Published episode';
  const audioUrl = buildPublicAudioUrl(episode.audioAssetId, baseUrl);
  const episodeUrl = buildPublishedEpisodeUrl(show, episode, baseUrl);
  const description = episode.launchPack?.showNotes || episode.launchPack?.description || summary;
  const explicit = resolveEpisodeExplicit(episode, show) ? 'yes' : 'no';
  const guid = episode.rssGuid || episodeUrl;
  const durationSeconds = episode.durationSeconds || episode.audioAssetId?.durationSeconds;

  return [
    '<item>',
    `<title>${escapeXml(episode.title || 'Untitled episode')}</title>`,
    `<link>${escapeXml(episodeUrl)}</link>`,
    `<guid isPermaLink="false">${escapeXml(guid)}</guid>`,
    `<pubDate>${escapeXml(formatPubDate(episode.publishedAt || new Date()))}</pubDate>`,
    `<description>${wrapCdata(description)}</description>`,
    `<itunes:summary>${wrapCdata(summary)}</itunes:summary>`,
    `<itunes:explicit>${explicit}</itunes:explicit>`,
    `<itunes:episodeType>${episode.episodeType === 'interview' ? 'full' : 'full'}</itunes:episodeType>`,
    episode.seasonNumber ? `<itunes:season>${episode.seasonNumber}</itunes:season>` : '',
    episode.episodeNumberForFeed ? `<itunes:episode>${episode.episodeNumberForFeed}</itunes:episode>` : '',
    durationSeconds ? `<itunes:duration>${formatDuration(durationSeconds)}</itunes:duration>` : '',
    `<enclosure url="${escapeXml(audioUrl)}" length="${Number(episode.audioAssetId?.byteSize || 0)}" type="${escapeXml(episode.audioAssetId?.mimeType || 'audio/mpeg')}" />`,
    '</item>',
  ].filter(Boolean).join('');
}

function buildPodcastFeedXml({ show, episodes, baseUrl }) {
  const showUrl = resolveShowWebsiteUrl(show, baseUrl);
  const imageUrl = resolveShowCoverImageUrl(show, baseUrl);
  const feedUrl = buildPodcastFeedUrl(show, baseUrl);
  const description = String(show.description || show.name || '').trim() || show.name;
  const lastBuildDate = episodes[0]?.publishedAt || show.lastPublishedAt || show.updatedAt || new Date();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
    '<channel>',
    `<title>${escapeXml(show.name)}</title>`,
    `<link>${escapeXml(showUrl)}</link>`,
    `<language>${escapeXml(show.language || 'en-us')}</language>`,
    `<description>${wrapCdata(description)}</description>`,
    `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />`,
    `<itunes:author>${escapeXml(show.authorName || show.name)}</itunes:author>`,
    `<itunes:summary>${wrapCdata(description)}</itunes:summary>`,
    `<itunes:explicit>${show.explicit ? 'yes' : 'no'}</itunes:explicit>`,
    `<itunes:owner><itunes:name>${escapeXml(show.authorName || show.name)}</itunes:name><itunes:email>${escapeXml(show.ownerEmail || 'support@vicpods.com')}</itunes:email></itunes:owner>`,
    `<itunes:image href="${escapeXml(imageUrl)}" />`,
    buildCategoryXml(show),
    show.copyright ? `<copyright>${escapeXml(show.copyright)}</copyright>` : '',
    `<lastBuildDate>${escapeXml(formatPubDate(lastBuildDate))}</lastBuildDate>`,
    ...episodes.map((episode) => buildItemXml(show, episode, baseUrl)),
    '</channel>',
    '</rss>',
  ].filter(Boolean).join('');
}

module.exports = {
  buildPodcastFeedXml,
};
