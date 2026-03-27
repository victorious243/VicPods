const { normalizeAppUrl } = require('../marketing/referralService');

function cleanText(value, maxLength = 600) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanList(value, maxItems = 8, maxLength = 220) {
  return (Array.isArray(value) ? value : [])
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function toSlug(value, fallback = 'vicpods-preview') {
  const normalized = cleanText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

function buildWatermarkFooter(appUrl) {
  const baseUrl = normalizeAppUrl(appUrl || process.env.APP_URL || 'http://localhost:3000');
  return [
    '',
    'Created with VicPods',
    'This is a light preview export.',
    `Explore the full workflow: ${baseUrl}`,
  ].join('\n');
}

function buildPreviewBody({
  heading,
  title,
  hook,
  outline,
  cta,
  launchPackTitles,
  launchPackDescription,
}) {
  return [
    heading,
    '',
    'TITLE',
    cleanText(title, 160) || 'Untitled preview',
    '',
    'HOOK',
    cleanText(hook, 700) || 'No hook available yet.',
    '',
    'OUTLINE',
    cleanList(outline, 8, 220).map((item, index) => `${index + 1}. ${item}`).join('\n') || '1. No outline available yet.',
    '',
    'LISTENER CTA',
    cleanText(cta, 420) || 'No CTA available yet.',
    '',
    'LAUNCH PACK PREVIEW',
    cleanList(launchPackTitles, 3, 180).length
      ? cleanList(launchPackTitles, 3, 180).map((item, index) => `${index + 1}. ${item}`).join('\n')
      : '1. Generate more to unlock title variations.',
    '',
    'SHORT DESCRIPTION',
    cleanText(launchPackDescription, 1200) || 'No launch description available yet.',
  ].join('\n');
}

function buildPublicPreviewExport(payload, { appUrl } = {}) {
  const title = cleanText(payload?.title, 160) || 'Episode Preview';
  return {
    filename: `${toSlug(title, 'vicpods-episode-preview')}.txt`,
    content: [
      buildPreviewBody({
        heading: 'VICPODS EPISODE PREVIEW',
        title,
        hook: payload?.hook,
        outline: payload?.outline,
        cta: payload?.cta,
        launchPackTitles: payload?.launchPackTitles,
        launchPackDescription: payload?.launchPackDescription,
      }),
      buildWatermarkFooter(appUrl),
    ].join('\n'),
  };
}

function buildEpisodeLightExport({ series, theme, episode, launchPackView }, { appUrl } = {}) {
  const title = cleanText(episode?.title, 160) || `Episode ${episode?.episodeNumberWithinTheme || ''}`.trim();
  const heading = [
    'VICPODS LIGHT EPISODE BRIEF',
    cleanText(series?.name, 120),
    cleanText(theme?.name, 120),
  ].filter(Boolean).join(' · ');

  return {
    filename: `${toSlug(title, 'vicpods-episode-brief')}.txt`,
    content: [
      buildPreviewBody({
        heading,
        title,
        hook: episode?.hook,
        outline: episode?.outline,
        cta: episode?.ending || episode?.endState,
        launchPackTitles: launchPackView?.titles,
        launchPackDescription: launchPackView?.description,
      }),
      buildWatermarkFooter(appUrl),
    ].join('\n'),
  };
}

module.exports = {
  buildEpisodeLightExport,
  buildPublicPreviewExport,
};
