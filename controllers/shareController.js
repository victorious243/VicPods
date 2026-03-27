const Episode = require('../models/Episode');
const { buildLaunchPack, buildLaunchPackView } = require('../services/launch/launchPackService');
const {
  buildEpisodeShareUrl,
  normalizeShareToken,
} = require('../services/sharing/episodeShareService');
const { AppError } = require('../utils/errors');
const { renderPage } = require('../utils/render');

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanOutline(outline) {
  return (Array.isArray(outline) ? outline : [])
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 10);
}

function hasLaunchPackContent(launchPack = {}) {
  return Boolean(
    (Array.isArray(launchPack.titles) && launchPack.titles.some(Boolean))
    || cleanText(launchPack.description)
    || cleanText(launchPack.showNotes)
    || (Array.isArray(launchPack.socialCaptions) && launchPack.socialCaptions.some(Boolean))
    || cleanText(launchPack.cta)
  );
}

function buildShareEpisodeView(episode) {
  const outline = cleanOutline(episode.outline);
  const previewSource = hasLaunchPackContent(episode.launchPack)
    ? episode.launchPack
    : buildLaunchPack({}, episode);
  const launchPackPreview = buildLaunchPackView(previewSource, {
    fullAccess: false,
  });

  if (!episode.launchPack?.updatedAt) {
    launchPackPreview.updatedAt = null;
  }

  return {
    title: cleanText(episode.title) || 'Untitled episode',
    hook: cleanText(episode.hook) || 'A structured episode preview shared from VicPods.',
    outline: outline.length ? outline : [
      'Sharpen the core idea into a clearer listener outcome.',
      'Structure the episode into sections that are easier to record.',
      'Turn the draft into launch-ready assets with the Launch Pack.',
    ],
    launchPackPreview,
  };
}

async function showSharedEpisode(req, res, next) {
  try {
    const shareToken = normalizeShareToken(req.params.token);

    if (!/^[a-f0-9]{24,64}$/.test(shareToken)) {
      throw new AppError('Shared episode not found.', 404);
    }

    const episode = await Episode.findOne({ shareToken })
      .select('title hook outline launchPack createdAt updatedAt shareToken')
      .lean();

    if (!episode) {
      throw new AppError('Shared episode not found.', 404);
    }

    const shareEpisode = buildShareEpisodeView(episode);
    const sharePageUrl = buildEpisodeShareUrl(episode.shareToken);
    const createEpisodeHref = req.currentUser ? '/create/single' : '/auth/register';

    return renderPage(res, {
      title: `${shareEpisode.title} - Shared with VicPods`,
      pageTitle: 'Shared Episode',
      subtitle: 'Read-only episode preview',
      view: 'share/episode',
      data: {
        publicShell: true,
        effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
        metaDescription: shareEpisode.hook,
        canonicalUrl: sharePageUrl,
        ogTitle: `${shareEpisode.title} - Shared with VicPods`,
        ogDescription: shareEpisode.hook,
        ogType: 'article',
        metaRobots: 'noindex, nofollow',
        shareEpisode,
        sharePageUrl,
        createEpisodeHref,
      },
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  showSharedEpisode,
};
