function episodeEditorPath({ seriesId, themeId, episodeId }) {
  return `/kitchen/${seriesId}/themes/${themeId}/episodes/${episodeId}`;
}

function podcastShowsPath() {
  return '/publish/shows';
}

function podcastFeedPath(showSlug) {
  return `/podcasts/${showSlug}/feed.xml`;
}

function publishedEpisodePath({ showSlug, episodeSlug }) {
  return `/podcasts/${showSlug}/${episodeSlug}`;
}

module.exports = {
  episodeEditorPath,
  podcastShowsPath,
  podcastFeedPath,
  publishedEpisodePath,
};
