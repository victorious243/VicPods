function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countItems(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .length;
}

function clampScore(value) {
  const number = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function uniqueList(values = [], maxItems = 5) {
  return [...new Set((values || []).map((value) => normalizeText(value)).filter(Boolean))].slice(0, maxItems);
}

function getStatusScore(status) {
  const normalized = String(status || '').trim();
  if (normalized === 'Served') {
    return 96;
  }
  if (normalized === 'Ready') {
    return 88;
  }
  if (normalized === 'Draft') {
    return 70;
  }
  return 54;
}

function buildCompletenessScore(episode = {}) {
  const checks = [
    Boolean(normalizeText(episode.title)),
    Boolean(normalizeText(episode.hook)),
    countItems(episode.outline) >= 3,
    countItems(episode.talkingPoints) >= 3,
    countItems(episode.hostQuestions) >= 3,
    Boolean(normalizeText(episode.ending)),
    episode.isSingle ? true : Boolean(normalizeText(episode.endState)),
  ];

  const passedCount = checks.filter(Boolean).length;
  return clampScore((passedCount / checks.length) * 100);
}

function buildQualityScore(episode = {}, completenessScore = 0) {
  if (Number.isFinite(episode.scriptDoctor?.overallScore)) {
    return clampScore(episode.scriptDoctor.overallScore);
  }

  return clampScore(Math.max(58, completenessScore - 8));
}

function buildToneScore(episode = {}) {
  if (Number.isFinite(episode.toneScore)) {
    return clampScore(episode.toneScore);
  }

  return 74;
}

function buildContinuityScore({ episode = {}, episodeContinuityContext = {} }) {
  if (episode.isSingle) {
    const singleBase = 92 - (episodeContinuityContext?.warnings?.length || 0) * 8;
    return clampScore(singleBase);
  }

  let score = 100;
  score -= (episodeContinuityContext?.warnings?.length || 0) * 12;

  if (!normalizeText(episode.endState)) {
    score -= 14;
  }

  if (!normalizeText(episodeContinuityContext?.seasonArcStep)) {
    score -= 10;
  }

  if (normalizeText(episodeContinuityContext?.gapSuggestion)) {
    score -= 8;
  }

  return clampScore(score);
}

function buildWorkflowScore(episode = {}) {
  let score = getStatusScore(episode.status);

  if (normalizeText(episode.timeEstimate?.summary)) {
    score += 4;
  }

  if (episode.showNotesPack?.updatedAt && episode.showNotesPack?.stale !== true) {
    score += 4;
  }

  return clampScore(score);
}

function buildReadinessState(score) {
  if (score >= 85) {
    return 'Release Ready';
  }
  if (score >= 72) {
    return 'Nearly Ready';
  }
  return 'Needs Work';
}

function buildBlockers({ episode = {}, qualityScore = 0, toneScore = 0, workflowScore = 0, episodeContinuityContext = {} }) {
  const blockers = [];

  if (!normalizeText(episode.title)) {
    blockers.push('Add a clear episode title.');
  }
  if (!normalizeText(episode.hook)) {
    blockers.push('Write or generate a stronger hook.');
  }
  if (countItems(episode.outline) < 3) {
    blockers.push('Expand the outline into at least 3 clear beats.');
  }
  if (countItems(episode.talkingPoints) < 3) {
    blockers.push('Add more concrete talking points.');
  }
  if (countItems(episode.hostQuestions) < 3) {
    blockers.push('Add sharper host questions.');
  }
  if (!normalizeText(episode.ending)) {
    blockers.push('Finish with a stronger close.');
  }
  if (!episode.isSingle && !normalizeText(episode.endState)) {
    blockers.push('Define the continuity end state for this series episode.');
  }
  if (qualityScore < 72) {
    blockers.push('Tighten the draft before release.');
  }
  if (toneScore < 70) {
    blockers.push('Improve tone consistency before release.');
  }
  if ((episodeContinuityContext?.warnings || []).length) {
    blockers.push('Resolve the continuity warning(s) before release.');
  }
  if (workflowScore < 80 && !['Ready', 'Served'].includes(String(episode.status || ''))) {
    blockers.push('Move the episode to Ready once the draft is locked.');
  }

  return uniqueList(blockers, 5);
}

function buildStrengths({ episode = {}, completenessScore = 0, qualityScore = 0, toneScore = 0, continuityScore = 0 }) {
  const strengths = [];

  if (completenessScore >= 85) {
    strengths.push('Core episode structure is filled in and usable.');
  }
  if (qualityScore >= 80) {
    strengths.push('Writing quality is already in a strong range.');
  }
  if (toneScore >= 80) {
    strengths.push('Tone consistency is holding well.');
  }
  if (continuityScore >= 84) {
    strengths.push(episode.isSingle
      ? 'Standalone positioning is clear and self-contained.'
      : 'Continuity and season positioning are in good shape.');
  }
  if (normalizeText(episode.timeEstimate?.summary)) {
    strengths.push('Estimated timing is ready for recording prep.');
  }
  if (episode.showNotesPack?.updatedAt && episode.showNotesPack?.stale !== true) {
    strengths.push('Show Notes Pack is already generated and fresh.');
  }

  return uniqueList(strengths, 5);
}

function buildNextActions({ episode = {}, blockers = [], episodeContinuityContext = {} }) {
  const actions = [...blockers];

  (episode.scriptDoctor?.recommendations || []).forEach((recommendation) => {
    actions.push(recommendation);
  });

  if (normalizeText(episodeContinuityContext?.gapSuggestion)) {
    actions.push(episodeContinuityContext.gapSuggestion);
  }

  if (!episode.showNotesPack?.updatedAt) {
    actions.push('Generate the Show Notes Pack for launch assets.');
  } else if (episode.showNotesPack?.stale) {
    actions.push('Refresh the Show Notes Pack after the latest edits.');
  }

  if (!['Ready', 'Served'].includes(String(episode.status || '')) && blockers.length <= 2) {
    actions.push('Set the episode status to Ready after final review.');
  }

  return uniqueList(actions, 5);
}

function buildReleaseReadiness({ episode = {}, episodeContinuityContext = {} }) {
  const completenessScore = buildCompletenessScore(episode);
  const qualityScore = buildQualityScore(episode, completenessScore);
  const toneScore = buildToneScore(episode);
  const continuityScore = buildContinuityScore({ episode, episodeContinuityContext });
  const workflowScore = buildWorkflowScore(episode);

  const overallScore = clampScore(
    (completenessScore * 0.32)
    + (qualityScore * 0.24)
    + (toneScore * 0.12)
    + (continuityScore * 0.18)
    + (workflowScore * 0.14)
  );

  const blockers = buildBlockers({
    episode,
    qualityScore,
    toneScore,
    workflowScore,
    episodeContinuityContext,
  });
  const strengths = buildStrengths({
    episode,
    completenessScore,
    qualityScore,
    toneScore,
    continuityScore,
  });
  const nextActions = buildNextActions({
    episode,
    blockers,
    episodeContinuityContext,
  });

  return {
    overallScore,
    stateLabel: buildReadinessState(overallScore),
    briefEligible: ['Ready', 'Served'].includes(String(episode.status || '')),
    subscores: {
      completenessScore,
      qualityScore,
      toneScore,
      continuityScore,
      workflowScore,
    },
    blockers,
    strengths,
    nextActions,
  };
}

module.exports = {
  buildReleaseReadiness,
};
