const { buildShowNotesSourceSignature } = require('../showNotes/showNotesPackService');

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRichText(value, maxLines = 12) {
  const lines = String(value || '')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter((line, index, source) => Boolean(line) || (index > 0 && source[index - 1]));

  return lines
    .slice(0, maxLines)
    .join('\n')
    .trim();
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function normalizeList(value, maxItems = 3) {
  return unique((Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item)))
    .slice(0, maxItems);
}

function buildFallbackTitles(episode = {}) {
  const baseTitle = normalizeText(episode.title) || 'Ready-to-record episode';

  return unique([
    baseTitle,
    `${baseTitle}: Sharper Episode Angle`,
    `${baseTitle}: Publish-Ready Cut`,
  ]).slice(0, 3);
}

function buildFallbackDescription(episode = {}) {
  if (normalizeText(episode.hook)) {
    return normalizeText(episode.hook);
  }

  const outlineLead = Array.isArray(episode.outline) && episode.outline.length
    ? normalizeText(episode.outline[0])
    : '';

  return outlineLead || 'A clear episode description is ready once the draft structure is in place.';
}

function buildFallbackShowNotes(episode = {}) {
  const bullets = (Array.isArray(episode.outline) ? episode.outline : [])
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 4);

  if (!bullets.length) {
    return 'Episode highlights, publishing notes, and key talking points will appear here after generation.';
  }

  return bullets.map((item) => `- ${item}`).join('\n');
}

function buildFallbackCaptions(episode = {}) {
  const baseTitle = normalizeText(episode.title) || 'New VicPods episode';
  const hook = normalizeText(episode.hook);

  return unique([
    `${baseTitle}. ${hook}`.trim(),
    `Recording soon: ${baseTitle}.`,
    `This episode turns one rough idea into a clearer recording plan.`,
  ]).slice(0, 3);
}

function buildFallbackCta(episode = {}) {
  const ending = normalizeText(episode.ending).replace(/\s+Teaser:.*$/i, '').trim();
  return ending || 'If this helped, follow the show and share the episode with one creator who should hear it next.';
}

function buildLaunchPackSourceSignature(episode = {}) {
  return buildShowNotesSourceSignature(episode);
}

function buildLaunchPack(payload = {}, episode = {}) {
  const titles = normalizeList(payload.titles, 3);
  const fallbackTitles = buildFallbackTitles(episode);

  return {
    titles: unique([...titles, ...fallbackTitles]).slice(0, 3),
    description: normalizeText(payload.description) || buildFallbackDescription(episode),
    showNotes: normalizeRichText(payload.showNotes, 14) || buildFallbackShowNotes(episode),
    socialCaptions: normalizeList(payload.socialCaptions, 3).length
      ? normalizeList(payload.socialCaptions, 3)
      : buildFallbackCaptions(episode),
    cta: normalizeText(payload.cta) || buildFallbackCta(episode),
    updatedAt: new Date(),
    stale: false,
    sourceSignature: buildLaunchPackSourceSignature(episode),
  };
}

function markLaunchPackStale(episode, previousSignature = '') {
  if (!episode?.launchPack?.updatedAt) {
    return episode;
  }

  const referenceSignature = previousSignature || episode.launchPack.sourceSignature || '';
  const currentSignature = buildLaunchPackSourceSignature(episode);

  if (!referenceSignature || referenceSignature !== currentSignature) {
    episode.launchPack.stale = true;
  }

  return episode;
}

function buildLaunchPackView(launchPack = {}, { fullAccess = false } = {}) {
  const titles = normalizeList(launchPack.titles, 3);

  return {
    titles,
    description: normalizeText(launchPack.description),
    showNotes: fullAccess ? normalizeRichText(launchPack.showNotes, 14) : '',
    socialCaptions: fullAccess ? normalizeList(launchPack.socialCaptions, 3) : [],
    cta: fullAccess ? normalizeText(launchPack.cta) : '',
    updatedAt: launchPack.updatedAt || null,
    stale: Boolean(launchPack.stale),
    accessLevel: fullAccess ? 'full' : 'preview',
    hasContent: Boolean(
      titles.length
      || normalizeText(launchPack.description)
      || normalizeRichText(launchPack.showNotes, 14)
      || normalizeList(launchPack.socialCaptions, 3).length
      || normalizeText(launchPack.cta)
    ),
  };
}

module.exports = {
  buildLaunchPack,
  buildLaunchPackSourceSignature,
  markLaunchPackStale,
  buildLaunchPackView,
};
