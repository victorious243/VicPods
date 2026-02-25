const { getTonePresetOrDefault } = require('./applyTone');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function countMatches(text, regex) {
  const match = text.match(regex);
  return match ? match.length : 0;
}

function getAvgSentenceLength(text) {
  const sentences = normalizeText(text)
    .split(/[.!?]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!sentences.length) {
    return 0;
  }

  const totalWords = sentences
    .map((sentence) => sentence.split(/\s+/).filter(Boolean).length)
    .reduce((sum, words) => sum + words, 0);

  return totalWords / sentences.length;
}

const PROFILE_CHECKS = {
  'Educational & Structured': {
    wanted: [/\b(step|framework|define|checklist|lesson)\b/gi, /\b(first|second|third|next|then)\b/gi],
    avoided: [/\bhot take|wild|crazy\b/gi],
    minSentence: 9,
    maxSentence: 19,
  },
  'Energetic & Motivational': {
    wanted: [/\b(now|today|move|momentum|win|action)\b/gi, /!/g],
    avoided: [/\bperhaps|maybe|possibly\b/gi],
    minSentence: 6,
    maxSentence: 15,
  },
  'Analytical & Deep': {
    wanted: [/\b(data|evidence|hypothesis|tradeoff|analysis|signal|metric)\b/gi],
    avoided: [/\bjust trust me|vibe\b/gi],
    minSentence: 11,
    maxSentence: 24,
  },
  'Storytelling & Emotional': {
    wanted: [/\bstory|moment|remember|felt|once|scene\b/gi],
    avoided: [/\bsynergy|stakeholder\b/gi],
    minSentence: 8,
    maxSentence: 20,
  },
  'Light & Humorous': {
    wanted: [/\bfun|playful|laugh|joke|awkward|messy\b/gi],
    avoided: [/\bquarterly|board-level\b/gi],
    minSentence: 6,
    maxSentence: 15,
  },
  'Professional & Corporate': {
    wanted: [/\bstrategy|outcome|execution|priority|roadmap|kpi|roi\b/gi],
    avoided: [/\blol|haha|wild\b/gi],
    minSentence: 10,
    maxSentence: 22,
  },
  'Calm & Reflective': {
    wanted: [/\bpause|reflect|consider|steady|intentional\b/gi],
    avoided: [/\bhot take|fight me\b/gi],
    minSentence: 9,
    maxSentence: 20,
  },
  'Conversational & Casual': {
    wanted: [/\b(let's|you|we|honestly|real talk)\b/gi],
    avoided: [/\bstakeholder alignment|enterprise-grade\b/gi],
    minSentence: 6,
    maxSentence: 17,
  },
  'Bold & Controversial': {
    wanted: [/\bhot take|unpopular|controversial|challenge|debate\b/gi],
    avoided: [/\bmaybe this could\b/gi],
    minSentence: 6,
    maxSentence: 18,
  },
};

function adjustForIntensity(baseScore, intensity, foundWantedCount) {
  const intensityValue = Number.isInteger(intensity) ? intensity : 3;
  const expected = Math.max(1, intensityValue - 1);

  if (foundWantedCount >= expected) {
    return baseScore + Math.min(6, foundWantedCount - expected + 2);
  }

  return baseScore - ((expected - foundWantedCount) * 4);
}

function computeToneConsistencyScore({ episode, tonePreset, toneIntensity }) {
  const preset = getTonePresetOrDefault(tonePreset);
  const profile = PROFILE_CHECKS[preset.name] || PROFILE_CHECKS['Conversational & Casual'];

  const sections = {
    hook: normalizeText(episode.hook),
    outline: normalizeText((episode.outline || []).join('. ')),
    talkingPoints: normalizeText((episode.talkingPoints || []).join('. ')),
    questions: normalizeText((episode.hostQuestions || []).join('? ')),
    ending: normalizeText(episode.ending),
  };

  const fullText = Object.values(sections).join(' ').trim();
  if (!fullText) {
    return {
      toneScore: 0,
      warnings: ['No episode content to score yet.'],
    };
  }

  let score = 70;
  const warnings = [];

  const wantedHits = profile.wanted
    .map((regex) => countMatches(fullText, regex))
    .reduce((sum, count) => sum + count, 0);

  const avoidedHits = profile.avoided
    .map((regex) => countMatches(fullText, regex))
    .reduce((sum, count) => sum + count, 0);

  score = adjustForIntensity(score, toneIntensity, wantedHits);

  if (avoidedHits > 0) {
    score -= Math.min(20, avoidedHits * 6);
    warnings.push(`Detected ${avoidedHits} phrase(s) that conflict with ${preset.name}.`);
  }

  const avgSentenceLength = getAvgSentenceLength(fullText);
  if (avgSentenceLength && avgSentenceLength < profile.minSentence) {
    score -= 8;
    warnings.push(`Sentence pacing is shorter than expected for ${preset.name}.`);
  }

  if (avgSentenceLength > profile.maxSentence) {
    score -= 8;
    warnings.push(`Sentence pacing is longer than expected for ${preset.name}.`);
  }

  const questionCount = (episode.hostQuestions || []).length;
  if (questionCount < 3) {
    score -= 5;
    warnings.push('Host questions are too sparse to establish consistent host voice.');
  }

  if (!sections.hook) {
    score -= 10;
    warnings.push('Hook is missing, so tone intent is unclear at the start.');
  }

  if (!sections.ending || !/(teaser|next)/i.test(sections.ending)) {
    score -= 6;
    warnings.push('Ending should include a clear teaser to preserve tonal continuity.');
  }

  if (/\bstakeholder|enterprise|board\b/i.test(fullText) && preset.name !== 'Professional & Corporate') {
    score -= 4;
    warnings.push('Tone drifted toward corporate phrasing.');
  }

  if (/\bhot take|controversial|fight me\b/i.test(fullText) && preset.name !== 'Bold & Controversial') {
    score -= 4;
    warnings.push('Tone drifted toward controversy language.');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    toneScore: score,
    warnings: warnings.slice(0, 6),
  };
}

module.exports = {
  computeToneConsistencyScore,
};
