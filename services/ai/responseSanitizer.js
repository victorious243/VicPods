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

function clampChars(text, maxChars) {
  const normalized = toStringSafe(text);
  if (normalized.length <= maxChars) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function sanitizeBulletArray(value, maxItems, { maxWords = 24, maxChars = 240 } = {}) {
  const input = Array.isArray(value) ? value : [];

  return input
    .map((item) => clampChars(toStringSafe(item), maxChars))
    .filter(Boolean)
    .slice(0, maxItems)
    .map((item) => clampWords(item, maxWords));
}

function ensureEndingHasTeaser(endingText, { requireTeaser = true } = {}) {
  const cleaned = clampWords(clampChars(endingText, 320), 45);
  if (!cleaned) {
    if (!requireTeaser) {
      return 'Takeaway: apply one key action this week and close with confidence.';
    }
    return 'Takeaway: apply one key action this week. Teaser: next episode raises the stakes with a new scenario.';
  }

  if (!requireTeaser) {
    return cleaned.replace(/\s+Teaser:.*$/i, '').trim();
  }

  if (/(teaser|next episode|next time)/i.test(cleaned)) {
    return cleaned;
  }

  return `${cleaned} Teaser: next episode builds on this with a sharper test.`;
}

function sanitizeEpisodePayload(payload, options = {}) {
  return {
    title: clampWords(payload.title, 14),
    hook: clampWords(clampChars(payload.hook, 320), 42),
    outline: sanitizeBulletArray(payload.outline, 7),
    talkingPoints: sanitizeBulletArray(payload.talkingPoints, 7),
    hostQuestions: sanitizeBulletArray(payload.hostQuestions, 8),
    funSegment: clampWords(clampChars(payload.funSegment, 700), 120),
    ending: ensureEndingHasTeaser(payload.ending, options),
    endState: clampWords(payload.endState, 80),
    seriesSummary: clampWords(payload.seriesSummary, 120),
    themeSummary: clampWords(payload.themeSummary, 120),
  };
}

function sanitizeSpicesPayload(payload) {
  return {
    hook: clampWords(clampChars(payload.hook, 320), 42),
    hostQuestions: sanitizeBulletArray(payload.hostQuestions, 8),
    funSegment: clampWords(clampChars(payload.funSegment, 700), 120),
  };
}

function sanitizeContinuityPayload(payload) {
  return {
    seriesSummary: clampWords(payload.seriesSummary, 120),
    themeSummary: clampWords(payload.themeSummary, 120),
    endState: clampWords(payload.endState, 80),
  };
}

function sanitizeToneFixPayload(payload, options = {}) {
  return {
    hook: clampWords(clampChars(payload.hook, 320), 42),
    hostQuestions: sanitizeBulletArray(payload.hostQuestions, 8),
    ending: ensureEndingHasTeaser(payload.ending, options),
  };
}

function sanitizeShowNotesPayload(payload) {
  return {
    summary: clampWords(clampChars(payload.summary, 520), 80),
    description: clampWords(clampChars(payload.description, 800), 120),
    keyTakeaways: sanitizeBulletArray(payload.keyTakeaways, 5, { maxWords: 20, maxChars: 180 }),
    listenerCTA: clampWords(clampChars(payload.listenerCTA, 320), 42),
    socialPosts: sanitizeBulletArray(payload.socialPosts, 3, { maxWords: 35, maxChars: 280 }),
  };
}

function sanitizeRichText(value, { maxLines = 14, maxChars = 2400, maxWordsPerLine = 40 } = {}) {
  const lines = String(value || '')
    .split('\n')
    .map((line) => clampChars(String(line || '').replace(/\s+/g, ' ').trim(), maxChars))
    .filter((line, index, source) => Boolean(line) || (index > 0 && source[index - 1]))
    .slice(0, maxLines)
    .map((line) => clampWords(line, maxWordsPerLine));

  return lines.join('\n').trim();
}

function sanitizeLaunchPackPayload(payload) {
  return {
    titles: sanitizeBulletArray(payload.titles, 3, { maxWords: 16, maxChars: 120 }),
    description: clampWords(clampChars(payload.description, 900), 130),
    showNotes: sanitizeRichText(payload.showNotes, { maxLines: 14, maxChars: 2600, maxWordsPerLine: 42 }),
    socialCaptions: sanitizeBulletArray(payload.socialCaptions, 3, { maxWords: 40, maxChars: 320 }),
    cta: clampWords(clampChars(payload.cta, 420), 60),
  };
}

function sanitizePodcastIdeasPayload(payload) {
  const items = Array.isArray(payload?.ideas) ? payload.ideas : [];

  return {
    ideas: items
      .map((item) => ({
        title: clampWords(clampChars(item?.title || item?.headline || item?.name, 140), 16),
        hookAngle: clampWords(clampChars(item?.hookAngle || item?.hook || item?.angle, 280), 38),
      }))
      .filter((item) => item.title && item.hookAngle)
      .slice(0, 10),
  };
}

module.exports = {
  sanitizeEpisodePayload,
  sanitizeSpicesPayload,
  sanitizeContinuityPayload,
  sanitizeToneFixPayload,
  sanitizeShowNotesPayload,
  sanitizeLaunchPackPayload,
  sanitizePodcastIdeasPayload,
};
