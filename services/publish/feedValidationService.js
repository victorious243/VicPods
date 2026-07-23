const { buildPublicAudioUrl } = require('./audioStorageService');
const { buildPodcastFeedUrl, resolveShowCoverImageUrl, resolveShowWebsiteUrl } = require('./publishService');

function hasText(value) {
  return Boolean(String(value || '').trim());
}

function hasPositiveNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function isAudioMimeType(value) {
  return /^audio\//i.test(String(value || '').trim());
}

function pushCheck(checks, key, label, passed, detail, severity = 'error') {
  checks.push({
    key,
    label,
    passed: Boolean(passed),
    detail,
    severity,
  });
}

function buildFeedValidation({ show, episodes = [], baseUrl }) {
  const checks = [];
  const publishedEpisodes = episodes.filter((episode) => episode.publishStatus === 'published');
  const feedUrl = buildPodcastFeedUrl(show, baseUrl);
  const coverImageUrl = resolveShowCoverImageUrl(show, baseUrl);
  const websiteUrl = resolveShowWebsiteUrl(show, baseUrl);

  pushCheck(checks, 'feed-url', 'Feed URL', isHttpUrl(feedUrl), 'The public RSS feed URL should resolve over http or https.');
  pushCheck(checks, 'show-slug', 'Show slug', hasText(show && show.slug), 'A stable show slug keeps the public feed URL predictable.');
  pushCheck(checks, 'show-name', 'Show name', hasText(show && show.name), 'Required for every podcast directory.');
  pushCheck(checks, 'description', 'Show description', hasText(show && show.description), 'Apple and Spotify expect a clear show description.');
  pushCheck(checks, 'author', 'Author name', hasText(show && show.authorName), 'Used as the public podcast author.');
  pushCheck(checks, 'owner-email', 'Owner email', hasText(show && show.ownerEmail), 'Required for directory verification and ownership contact.');
  pushCheck(checks, 'language', 'Language', hasText(show && show.language), 'RSS language should be set, for example en-us.');
  pushCheck(checks, 'category', 'Primary category', hasText(show && show.categoryPrimary), 'Directories use this to classify the show.');
  pushCheck(checks, 'cover', 'Cover artwork', isHttpUrl(coverImageUrl), 'Use a valid cover artwork URL before submission.');
  pushCheck(checks, 'website', 'Show website', isHttpUrl(websiteUrl), 'A public website or VicPods show page should resolve.');
  pushCheck(checks, 'episodes', 'Published episode', publishedEpisodes.length > 0, 'At least one public episode should be live before submission.');

  publishedEpisodes.slice(0, 10).forEach((episode, index) => {
    const labelPrefix = 'Episode ' + (index + 1);
    const keyPrefix = 'episode-' + (episode._id || index);
    const audioUrl = episode.audioAssetId ? buildPublicAudioUrl(episode.audioAssetId, baseUrl) : '';
    pushCheck(checks, keyPrefix + '-title', labelPrefix + ' title', hasText(episode.title), 'Published episodes need a title.');
    pushCheck(checks, keyPrefix + '-summary', labelPrefix + ' summary', hasText(episode.summary), 'Published episodes need a summary or launch description.');
    pushCheck(
      checks,
      keyPrefix + '-audio',
      labelPrefix + ' audio',
      Boolean(audioUrl),
      'Published episodes need a public MP3 enclosure.'
    );
    pushCheck(checks, keyPrefix + '-audio-url', labelPrefix + ' audio URL', isHttpUrl(audioUrl), 'The episode enclosure URL should resolve publicly.');
    pushCheck(checks, keyPrefix + '-audio-type', labelPrefix + ' audio MIME type', isAudioMimeType(episode.audioAssetId?.mimeType || 'audio/mpeg'), 'The enclosure should expose an audio MIME type.', 'warning');
    pushCheck(checks, keyPrefix + '-audio-bytes', labelPrefix + ' audio byte size', hasPositiveNumber(episode.audioAssetId?.byteSize), 'Directories prefer a real enclosure byte size.', 'warning');
    pushCheck(checks, keyPrefix + '-published-at', labelPrefix + ' publish date', Boolean(episode.publishedAt), 'Published episodes should carry a release date.', 'warning');
    pushCheck(checks, keyPrefix + '-duration', labelPrefix + ' duration', hasPositiveNumber(episode.durationSeconds || episode.audioAssetId?.durationSeconds), 'Add a duration so players and directories can display runtime.', 'warning');
    pushCheck(checks, keyPrefix + '-guid', labelPrefix + ' GUID', hasText(episode.rssGuid) || hasText(episode.publicSlug), 'A stable GUID or public slug helps keep episode identity consistent.', 'warning');
    pushCheck(checks, keyPrefix + '-notes', labelPrefix + ' show notes', hasText(episode.launchPack?.showNotes || episode.launchPack?.description || episode.summary), 'Published episodes should include useful notes or description copy.', 'warning');
    pushCheck(checks, keyPrefix + '-chapters', labelPrefix + ' chapter markers', Array.isArray(episode.chapters) ? episode.chapters.length > 0 : false, 'Chapter markers help richer playback surfaces and imports.', 'warning');
  });

  const errorCount = checks.filter((check) => !check.passed && check.severity === 'error').length;
  const warningCount = checks.filter((check) => !check.passed && check.severity === 'warning').length;

  return {
    feedUrl,
    coverImageUrl,
    websiteUrl,
    checks,
    errorCount,
    warningCount,
    passed: errorCount === 0,
  };
}

module.exports = {
  buildFeedValidation,
};
