function normalizeAppUrl(appUrl) {
  const fallbackUrl = String(process.env.APP_URL || 'http://localhost:3000').trim();
  return String(appUrl || fallbackUrl)
    .trim()
    .replace(/\/+$/, '');
}

function normalizeShareToken(token) {
  return String(token || '')
    .trim()
    .toLowerCase();
}

function buildEpisodeShareUrl(token, appUrl) {
  const normalizedToken = normalizeShareToken(token);
  if (!normalizedToken) {
    return '';
  }

  return `${normalizeAppUrl(appUrl)}/share/${encodeURIComponent(normalizedToken)}`;
}

async function ensureEpisodeShareUrl(episode, appUrl) {
  if (!episode) {
    return '';
  }

  const shareToken = await episode.ensureShareToken();
  return buildEpisodeShareUrl(shareToken, appUrl);
}

module.exports = {
  normalizeAppUrl,
  normalizeShareToken,
  buildEpisodeShareUrl,
  ensureEpisodeShareUrl,
};
