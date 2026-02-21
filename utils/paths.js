function episodeEditorPath({ seriesId, themeId, episodeId }) {
  return `/kitchen/${seriesId}/themes/${themeId}/episodes/${episodeId}`;
}

module.exports = {
  episodeEditorPath,
};
