function toStringSafe(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampWords(text, maxWords) {
  const words = toStringSafe(text).split(' ').filter(Boolean);
  if (words.length <= maxWords) {
    return words.join(' ');
  }

  return `${words.slice(0, maxWords).join(' ')}...`;
}

function sanitizeBulletArray(value, maxItems) {
  const input = Array.isArray(value) ? value : [];

  return input
    .map((item) => toStringSafe(item))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => clampWords(item, 24));
}

function sanitizeEpisodePayload(payload) {
  return {
    title: clampWords(payload.title, 14),
    hook: clampWords(payload.hook, 42),
    outline: sanitizeBulletArray(payload.outline, 7),
    talkingPoints: sanitizeBulletArray(payload.talkingPoints, 7),
    hostQuestions: sanitizeBulletArray(payload.hostQuestions, 8),
    funSegment: clampWords(payload.funSegment, 34),
    ending: clampWords(payload.ending, 45),
    endState: clampWords(payload.endState, 80),
    seriesSummary: clampWords(payload.seriesSummary, 120),
    themeSummary: clampWords(payload.themeSummary, 120),
  };
}

function sanitizeSpicesPayload(payload) {
  return {
    hook: clampWords(payload.hook, 42),
    hostQuestions: sanitizeBulletArray(payload.hostQuestions, 8),
    funSegment: clampWords(payload.funSegment, 34),
  };
}

function sanitizeContinuityPayload(payload) {
  return {
    seriesSummary: clampWords(payload.seriesSummary, 120),
    themeSummary: clampWords(payload.themeSummary, 120),
    endState: clampWords(payload.endState, 80),
  };
}

module.exports = {
  sanitizeEpisodePayload,
  sanitizeSpicesPayload,
  sanitizeContinuityPayload,
};
