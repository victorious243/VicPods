const Episode = require('../../models/Episode');
const { episodeEditorPath } = require('../../utils/paths');

function buildEpisodeHref(episode) {
  if (!episode?.seriesId || !episode?.themeId || !episode?._id) {
    return '/kitchen';
  }

  return episodeEditorPath({
    seriesId: episode.seriesId,
    themeId: episode.themeId,
    episodeId: episode._id,
  });
}

function buildChecklistStep({ key, label, description, complete, href, ctaLabel }) {
  return {
    key,
    label,
    description,
    complete: Boolean(complete),
    href,
    ctaLabel,
  };
}

async function buildActivationChecklist({ userId }) {
  const [episodeCount, latestEpisode, generatedDraftEpisode, launchPackEpisode, sharedEpisode] = await Promise.all([
    Episode.countDocuments({ userId }),
    Episode.findOne({ userId })
      .sort({ updatedAt: -1 })
      .select('_id seriesId themeId title'),
    Episode.findOne({
      userId,
      $or: [
        { hook: { $exists: true, $nin: ['', null] } },
        { 'outline.0': { $exists: true } },
      ],
    })
      .sort({ updatedAt: -1 })
      .select('_id seriesId themeId title'),
    Episode.findOne({
      userId,
      'launchPack.updatedAt': { $ne: null },
    })
      .sort({ updatedAt: -1 })
      .select('_id seriesId themeId title'),
    Episode.findOne({
      userId,
      shareLinkCopiedAt: { $ne: null },
    })
      .sort({ shareLinkCopiedAt: -1 })
      .select('_id seriesId themeId title'),
  ]);

  const latestEpisodeHref = buildEpisodeHref(latestEpisode);
  const generatedDraftHref = buildEpisodeHref(generatedDraftEpisode || latestEpisode);
  const launchPackHref = buildEpisodeHref(launchPackEpisode || generatedDraftEpisode || latestEpisode);
  const sharedHref = buildEpisodeHref(sharedEpisode || launchPackEpisode || generatedDraftEpisode || latestEpisode);

  const steps = [
    buildChecklistStep({
      key: 'create_episode',
      label: 'Create an episode',
      description: 'Start with one focused episode shell in Studio or Workspace.',
      complete: episodeCount > 0,
      href: episodeCount > 0 ? latestEpisodeHref : '/create/single',
      ctaLabel: episodeCount > 0 ? 'Open episode' : 'Start episode',
    }),
    buildChecklistStep({
      key: 'generate_draft',
      label: 'Generate a draft',
      description: 'Turn the idea into a hook, outline, and recording-ready direction.',
      complete: Boolean(generatedDraftEpisode),
      href: generatedDraftHref,
      ctaLabel: generatedDraftEpisode ? 'Review draft' : 'Generate draft',
    }),
    buildChecklistStep({
      key: 'generate_launch_pack',
      label: 'Generate a Launch Pack',
      description: 'Create publish-ready titles, a description, and launch assets.',
      complete: Boolean(launchPackEpisode),
      href: launchPackHref,
      ctaLabel: launchPackEpisode ? 'Open Launch Pack' : 'Create Launch Pack',
    }),
    buildChecklistStep({
      key: 'share_episode',
      label: 'Share an episode',
      description: 'Send a read-only episode page or export a preview to keep momentum moving.',
      complete: Boolean(sharedEpisode),
      href: sharedHref,
      ctaLabel: sharedEpisode ? 'Shared already' : 'Share episode',
    }),
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const nextStep = steps.find((step) => !step.complete) || steps[steps.length - 1];

  return {
    completedCount,
    totalCount: steps.length,
    progressPercent: Math.round((completedCount / steps.length) * 100),
    steps,
    nextStep,
  };
}

module.exports = {
  buildActivationChecklist,
};
