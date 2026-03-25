const crypto = require('crypto');

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeList(value, maxItems = 8) {
  return (Array.isArray(value) ? value : [])
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildShowNotesSourceSignature(episode = {}) {
  const payload = JSON.stringify({
    title: normalizeText(episode.title),
    hook: normalizeText(episode.hook),
    outline: normalizeList(episode.outline, 7),
    talkingPoints: normalizeList(episode.talkingPoints, 7),
    hostQuestions: normalizeList(episode.hostQuestions, 8),
    funSegment: normalizeText(episode.funSegment),
    ending: normalizeText(episode.ending),
    endState: normalizeText(episode.endState),
    episodeType: normalizeText(episode.episodeType),
    targetLength: normalizeText(episode.targetLength),
    formatTemplate: normalizeText(episode.formatTemplate),
    hookStyle: normalizeText(episode.hookStyle),
    deliveryStyle: normalizeText(episode.deliveryStyle),
    includeFunSegment: episode.includeFunSegment !== false,
  });

  return crypto.createHash('sha1').update(payload).digest('hex');
}

function buildShowNotesPack(payload = {}, episode = {}) {
  return {
    summary: normalizeText(payload.summary),
    description: normalizeText(payload.description),
    keyTakeaways: normalizeList(payload.keyTakeaways, 5),
    listenerCTA: normalizeText(payload.listenerCTA),
    socialPosts: normalizeList(payload.socialPosts, 3),
    updatedAt: new Date(),
    stale: false,
    sourceSignature: buildShowNotesSourceSignature(episode),
  };
}

function markShowNotesPackStale(episode, previousSignature = '') {
  if (!episode?.showNotesPack?.updatedAt) {
    return episode;
  }

  const referenceSignature = previousSignature || episode.showNotesPack.sourceSignature || '';
  const currentSignature = buildShowNotesSourceSignature(episode);

  if (!referenceSignature || referenceSignature !== currentSignature) {
    episode.showNotesPack.stale = true;
  }

  return episode;
}

module.exports = {
  buildShowNotesPack,
  buildShowNotesSourceSignature,
  markShowNotesPackStale,
};
