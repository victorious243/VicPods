function sanitizeSegment(value, maxLength = 36) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return 'Untitled';
  }

  return normalized.slice(0, maxLength);
}

function buildTranscriptFilename({ seriesName, themeName, episodeNumberWithinTheme, extension }) {
  const safeSeries = sanitizeSegment(seriesName, 30);
  const safeTheme = sanitizeSegment(themeName, 24);
  const safeEpisode = Number.isInteger(Number(episodeNumberWithinTheme))
    ? Number(episodeNumberWithinTheme)
    : 'X';

  return `VicPods_EpisodeBrief_${safeSeries}_${safeTheme}_Ep${safeEpisode}.${extension}`;
}

module.exports = {
  sanitizeSegment,
  buildTranscriptFilename,
};
