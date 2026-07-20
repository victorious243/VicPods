const { buildPublicAudioUrl } = require('./audioStorageService');
const { buildPodcastFeedUrl, resolveShowCoverImageUrl, resolveShowWebsiteUrl } = require('./publishService');

function hasText(value) {
  return Boolean(String(value || '').trim());
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
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
    pushCheck(checks, keyPrefix + '-title', labelPrefix + ' title', hasText(episode.title), 'Published episodes need a title.');
    pushCheck(checks, keyPrefix + '-summary', labelPrefix + ' summary', hasText(episode.summary), 'Published episodes need a summary or launch description.');
    pushCheck(
      checks,
      keyPrefix + '-audio',
      labelPrefix + ' audio',
      Boolean(episode.audioAssetId && buildPublicAudioUrl(episode.audioAssetId, baseUrl)),
      'Published episodes need a public MP3 enclosure.'
    );
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
