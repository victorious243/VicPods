const aiService = require('../ai/aiService');
const { normalizeLanguage } = require('../i18n/languageService');
const { resolveEffectiveTone } = require('../tone/toneService');
const { AppError } = require('../../utils/errors');

const IDEA_MIN_LENGTH = 12;
const IDEA_MAX_LENGTH = 900;
const FALLBACK_OUTLINE = [
  'Frame the core listener problem and why it matters right now.',
  'Break the idea into a simple structure listeners can follow.',
  'Add one concrete example or story that makes the angle usable.',
  'Close with one action listeners can take before the next recording.',
];

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'how', 'idea',
  'ideas', 'if', 'in', 'into', 'is', 'it', 'its', 'more', 'my', 'of', 'on', 'or', 'our',
  'podcast', 'podcasts', 'so', 'that', 'the', 'their', 'them', 'there', 'this', 'to',
  'we', 'what', 'when', 'with', 'your',
]);

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value, maxLength) {
  const normalized = cleanText(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, Math.max(0, maxLength - 3)).trim();
  const safeTruncate = truncated.includes(' ')
    ? truncated.slice(0, truncated.lastIndexOf(' ')).trim()
    : truncated;

  return `${safeTruncate || truncated}...`;
}

function toTitleCase(value) {
  return cleanText(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeIdea(value) {
  return clampText(value, IDEA_MAX_LENGTH);
}

function validateIdea(value) {
  const idea = normalizeIdea(value);

  if (!idea || idea.length < IDEA_MIN_LENGTH) {
    throw new AppError('Add a clearer podcast idea before generating a preview.', 400);
  }

  return idea;
}

function tokenizeIdea(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function unique(list) {
  return [...new Set(list.filter(Boolean))];
}

function stripLeadIn(value) {
  return cleanText(value)
    .replace(/^(i want|give me|generate|create)\s+/i, '')
    .replace(/^(an?|the)\s+/i, '')
    .replace(/^(podcast\s+)?(episode|show)\s+(about|on)\s+/i, '')
    .replace(/^(idea|topic)\s+(about|on)\s+/i, '')
    .trim();
}

function extractTopic(idea) {
  const normalizedIdea = stripLeadIn(idea);
  const firstSentence = cleanText(String(normalizedIdea || '').split(/[.!?\n]/)[0]);

  if (firstSentence && firstSentence.length <= 64) {
    return firstSentence;
  }

  const broadHowMatch = normalizedIdea.match(/\bhow\b\s+(.+?)(?:\s+(?:for|so|because)\s+|$)/i);
  if (broadHowMatch?.[1]) {
    return `How ${clampText(broadHowMatch[1], 52)}`;
  }

  const howToMatch = normalizedIdea.match(/\bhow to\s+(.+?)(?:\s+(?:for|so|because)\s+|$)/i);
  if (howToMatch?.[1]) {
    return `How to ${clampText(howToMatch[1], 52)}`;
  }

  const whyMatch = normalizedIdea.match(/\bwhy\s+(.+?)(?:\s+and\s+how to|\s+(?:for|so|because)\s+|$)/i);
  if (whyMatch?.[1]) {
    return `Why ${clampText(whyMatch[1], 52)}`;
  }

  const keywords = tokenizeIdea(normalizedIdea).slice(0, 5);
  if (keywords.length) {
    return toTitleCase(keywords.join(' '));
  }

  return 'Stronger Podcast Episodes';
}

function buildContentPillars(idea, topic) {
  const keywordPhrases = tokenizeIdea(idea)
    .slice(0, 8)
    .map((token) => toTitleCase(token));

  return unique([
    toTitleCase(topic),
    ...keywordPhrases,
    'Clear Listener Outcome',
    'Actionable Episode Structure',
  ]).slice(0, 4);
}

function buildAudienceProblem(topic) {
  return `Creators have a strong idea around ${cleanText(topic).toLowerCase()}, but the episode still needs a sharper structure before recording.`;
}

function buildListenerTransformation(topic) {
  return `Turn ${cleanText(topic).toLowerCase()} into a clear episode direction listeners can understand and act on quickly.`;
}

function detectEpisodeType(idea) {
  return /(interview|guest|conversation|q&a|q and a|founder chat|expert chat)/i.test(idea)
    ? 'interview'
    : 'solo';
}

function detectTargetLength(idea) {
  if (idea.length > 320 || /(deep dive|breakdown|full guide|case study|step by step|framework)/i.test(idea)) {
    return '20-30';
  }

  return '10-15';
}

function detectFormatTemplate(idea) {
  if (/(interview|guest|conversation|q&a|q and a)/i.test(idea)) {
    return 'interview_extraction';
  }

  if (/(myth|wrong|mistake|misconception|stop doing)/i.test(idea)) {
    return 'myth_buster';
  }

  if (/(story|journey|behind the scenes|what happened|lesson learned|case study)/i.test(idea)) {
    return 'story_to_strategy';
  }

  return 'signature_framework';
}

function detectHookStyle(idea) {
  if (/(myth|wrong|mistake|misconception)/i.test(idea)) {
    return 'myth_break';
  }

  if (/\?/.test(idea) || /^(how|why|what|when)\b/i.test(cleanText(idea))) {
    return 'question_led';
  }

  if (/(story|journey|behind the scenes|lesson learned|case study)/i.test(idea)) {
    return 'story_scene';
  }

  if (/(hot take|unpopular|controversial|everyone is wrong)/i.test(idea)) {
    return 'bold_claim';
  }

  return 'problem_first';
}

function detectTonePreset(idea) {
  if (/(story|journey|behind the scenes|personal|listener|moment)/i.test(idea)) {
    return 'Storytelling & Emotional';
  }

  if (/(framework|analysis|analyze|strategy|research|data|system|breakdown)/i.test(idea)) {
    return 'Analytical & Deep';
  }

  if (/(launch|growth|momentum|motivation|energy|challenge)/i.test(idea)) {
    return 'Energetic & Motivational';
  }

  return 'Conversational & Casual';
}

function detectDeliveryStyle(tonePreset) {
  if (tonePreset === 'Analytical & Deep') {
    return 'expert';
  }

  if (tonePreset === 'Storytelling & Emotional') {
    return 'storytelling';
  }

  if (tonePreset === 'Energetic & Motivational') {
    return 'authoritative';
  }

  return 'friendly';
}

function buildFallbackTitle(topic) {
  const normalizedTopic = cleanText(topic);
  if (!normalizedTopic) {
    return 'Ready-to-Record Episode Preview';
  }

  if (/^(how|why|what|when)\b/i.test(normalizedTopic)) {
    return `${normalizedTopic.charAt(0).toUpperCase()}${normalizedTopic.slice(1)}`;
  }

  return `${toTitleCase(normalizedTopic)} Episode Blueprint`;
}

function buildFallbackHook(topic) {
  return `This episode turns ${cleanText(topic).toLowerCase()} into a clearer hook, structure, and next step for listeners.`;
}

function buildFallbackCta(topic) {
  return `Turn ${cleanText(topic).toLowerCase()} into one clear talking point and test it in your next recording.`;
}

function outlineRank(item, index) {
  const normalized = cleanText(item).toLowerCase();
  const order = [
    ['guest hook', 0],
    ['hook', 1],
    ['scene', 2],
    ['myth', 3],
    ['context', 4],
    ['meaning', 5],
    ['why it fails', 6],
    ['framework', 7],
    ['insight', 8],
    ['lesson', 9],
    ['better model', 10],
    ['breakdown', 11],
    ['example', 12],
    ['action', 13],
    ['outro', 14],
  ];

  const match = order.find(([keyword]) => normalized.includes(keyword));
  return match ? match[1] : (100 + index);
}

function buildVirtualContext(idea) {
  const topic = extractTopic(idea);
  const tonePreset = detectTonePreset(idea);
  const episodeType = detectEpisodeType(idea);
  const targetLength = detectTargetLength(idea);
  const formatTemplate = detectFormatTemplate(idea);
  const hookStyle = detectHookStyle(idea);
  const contentPillars = buildContentPillars(idea, topic);
  const audienceProblem = buildAudienceProblem(topic);
  const listenerTransformation = buildListenerTransformation(topic);

  const series = {
    name: 'VicPods Idea Preview',
    description: clampText(idea, 260),
    audience: 'Podcast creators shaping one raw idea into a stronger episode.',
    goal: 'Turn rough podcast ideas into clear, ready-to-record episode plans.',
    seriesSummary: 'VicPods helps creators move from raw idea to structured episode direction before they record.',
    tonePreset,
    toneIntensity: 4,
    audienceType: 'Mixed',
    intent: 'educate',
    voicePersona: '',
    showBlueprint: {
      audienceProblem,
      listenerTransformation,
      contentPillars,
      ctaStyle: 'direct_action',
      bannedWords: ['generic', 'fluff'],
      brandVoiceRules: [
        'Stay specific and structured.',
        'Keep the host voice clear, confident, and practical.',
      ],
    },
    seriesBible: {
      seasonGoal: 'Prove the value of turning rough podcast ideas into sharper episode plans.',
      audiencePromise: 'Leave with a clearer episode angle and one practical next action.',
      recurringThemes: contentPillars,
    },
    defaultEpisodeType: episodeType,
    defaultTargetLength: targetLength,
    defaultIncludeFunSegment: false,
    defaultFormatTemplate: formatTemplate,
    defaultHookStyle: hookStyle,
    defaultDeliveryStyle: detectDeliveryStyle(tonePreset),
  };

  const theme = {
    name: toTitleCase(topic),
    description: clampText(idea, 220),
    themeSummary: 'This standalone preview shapes one raw podcast idea into a stronger recording plan.',
  };

  const episode = {
    title: buildFallbackTitle(topic),
    episodeNumberWithinTheme: 1,
    globalEpisodeNumber: 1,
    episodeType,
    targetLength,
    includeFunSegment: false,
    formatTemplate,
    hookStyle,
    deliveryStyle: detectDeliveryStyle(tonePreset),
    outline: [],
    talkingPoints: [],
    hostQuestions: [],
    funSegment: '',
    ending: '',
    isSingle: true,
  };

  return {
    topic,
    series,
    theme,
    episode,
    effectiveTone: resolveEffectiveTone({
      series,
      episode,
      includePersona: false,
      plan: 'premium',
    }),
  };
}

function normalizeOutline(outline) {
  const items = Array.isArray(outline) ? outline : [];
  const cleaned = items
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 6);

  if (!cleaned.length) {
    return FALLBACK_OUTLINE;
  }

  const looksTemplated = cleaned.some((item) => /move .+ toward /i.test(item) || item.includes('...'));
  if (looksTemplated) {
    return FALLBACK_OUTLINE;
  }

  return cleaned
    .map((item, index) => ({ item, rank: outlineRank(item, index) }))
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.item);
}

function deriveFallbackCta(_ending, topic) {
  return buildFallbackCta(topic);
}

function normalizePublicCta(listenerCta, fallback) {
  const cleaned = cleanText(listenerCta)
    .replace(/\b(End with|Close with)\b.*$/i, '')
    .trim();

  if (!cleaned || /^Takeaway:/i.test(cleaned) || cleaned.endsWith(' and')) {
    return fallback;
  }

  return cleaned || fallback;
}

function buildFallbackLaunchPack(topic, episode) {
  const normalizedTopic = cleanText(topic).toLowerCase();

  return {
    titles: unique([
      episode.title,
      `${episode.title}: Sharper Publish Angle`,
      `${toTitleCase(topic)}: Launch-Ready Version`,
    ]).slice(0, 3),
    description: `A concise launch description for ${normalizedTopic} is ready so the episode feels publishable, not just planned.`,
    showNotes: 'Full show notes unlock once you move the idea into the full VicPods workflow.',
    socialCaptions: [
      `New episode: ${episode.title}.`,
      `A clearer angle on ${normalizedTopic}.`,
      'This idea is now closer to publish-ready.',
    ],
    cta: buildFallbackCta(topic),
  };
}

function selectPublicTitle(generatedTitle, fallbackTitle) {
  const cleaned = cleanText(generatedTitle);

  if (!cleaned) {
    return fallbackTitle;
  }

  if (cleaned.includes('...') || /\bEpisode\s+\d+\s+-\s+Structured/i.test(cleaned)) {
    return fallbackTitle;
  }

  return clampText(cleaned, 96);
}

function selectPublicHook(generatedHook, fallbackHook) {
  const cleaned = cleanText(generatedHook);

  if (!cleaned) {
    return fallbackHook;
  }

  if (cleaned.includes('...') || cleaned.includes('Today we turn that into Turn') || /\.\./.test(cleaned)) {
    return fallbackHook;
  }

  return clampText(cleaned, 260);
}

async function generatePublicEpisodePreview({ idea, language = 'en' }) {
  const normalizedIdea = validateIdea(idea);
  const outputLanguage = normalizeLanguage(language);
  const { topic, series, theme, episode, effectiveTone } = buildVirtualContext(normalizedIdea);

  const generatedDraft = await aiService.generateEpisodeDraft({
    language: outputLanguage,
    series,
    theme,
    episode,
    callbackSuggestions: [],
    continuityWarnings: [],
    seasonArcStep: '',
    episodeNumberWithinTheme: 1,
    globalEpisodeNumber: 1,
    previousEpisodeEndState: null,
    existingEpisodeTitles: [],
    ingredientHooks: [normalizedIdea],
    existingTitle: episode.title,
    effectiveTone,
    episodeType: episode.episodeType,
    targetLength: episode.targetLength,
    includeFunSegment: false,
    isStandalone: true,
    requireTeaser: false,
  });

  const generatedEpisode = {
    ...episode,
    ...generatedDraft,
    title: selectPublicTitle(generatedDraft.title, episode.title),
    hook: selectPublicHook(generatedDraft.hook, buildFallbackHook(topic)),
    outline: normalizeOutline(generatedDraft.outline),
    talkingPoints: Array.isArray(generatedDraft.talkingPoints) ? generatedDraft.talkingPoints : [],
    hostQuestions: Array.isArray(generatedDraft.hostQuestions) ? generatedDraft.hostQuestions : [],
    ending: cleanText(generatedDraft.ending),
  };

  const launchPack = await aiService.generateLaunchPack({
    language: outputLanguage,
    series,
    theme,
    episode: generatedEpisode,
    effectiveTone,
    seasonArcStep: 'Standalone public preview',
    continuityWarnings: [],
    callbackSuggestions: [],
  });
  const safeLaunchPack = launchPack && Array.isArray(launchPack.titles) && launchPack.titles.length
    ? launchPack
    : buildFallbackLaunchPack(topic, generatedEpisode);

  return {
    title: generatedEpisode.title,
    hook: generatedEpisode.hook,
    outline: generatedEpisode.outline,
    cta: normalizePublicCta(
      safeLaunchPack.cta,
      deriveFallbackCta(generatedEpisode.ending, topic)
    ),
    launchPack: safeLaunchPack,
  };
}

module.exports = {
  IDEA_MAX_LENGTH,
  IDEA_MIN_LENGTH,
  generatePublicEpisodePreview,
};
