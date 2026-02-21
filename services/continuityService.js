function cleanSentence(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateWords(text, maxWords) {
  const words = cleanSentence(text).split(' ').filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }
  return `${words.slice(0, maxWords).join(' ')}...`;
}

function summarizeEpisodes(episodes, label = 'E') {
  return episodes.map((episode) => {
    const number = episode.episodeNumberWithinTheme || episode.globalEpisodeNumber || '?';
    const title = cleanSentence(episode.title || `Episode ${number}`);
    const endState = cleanSentence(episode.endState || episode.ending || 'Progressed the arc.');
    return `${label}${number} ${title}: ${endState}`;
  });
}

function refreshContinuityFromEpisodes({
  series,
  theme,
  priorThemeEpisodes,
  recentSeriesEpisodes,
  currentEpisode,
}) {
  const latestTheme = (priorThemeEpisodes || [])
    .slice()
    .sort((a, b) => a.episodeNumberWithinTheme - b.episodeNumberWithinTheme)
    .slice(-3);

  const latestSeries = (recentSeriesEpisodes || [])
    .slice()
    .sort((a, b) => (a.globalEpisodeNumber || 0) - (b.globalEpisodeNumber || 0))
    .slice(-4);

  const themeSummary = truncateWords(
    `${cleanSentence(theme.name)} focuses on ${cleanSentence(theme.description || 'a focused podcast arc')}. ${summarizeEpisodes(latestTheme, 'E').join(' ')}`,
    120
  );

  const seriesSummary = truncateWords(
    `${cleanSentence(series.name)} for ${cleanSentence(series.audience || 'curious listeners')}. ${summarizeEpisodes(latestSeries, 'G').join(' ')}`,
    120
  );

  const currentPoints = (currentEpisode.talkingPoints || []).slice(0, 2).map(cleanSentence).join(' | ');
  const ending = cleanSentence(currentEpisode.ending || 'Closes with a clear takeaway and teaser.');
  const endState = truncateWords(
    `Episode ${currentEpisode.episodeNumberWithinTheme} in ${cleanSentence(theme.name)} now leaves listeners with ${ending} Next carry-forward: ${currentPoints || 'build the next angle without repeating points.'}`,
    80
  );

  return {
    seriesSummary,
    themeSummary,
    endState,
  };
}

module.exports = {
  refreshContinuityFromEpisodes,
};
