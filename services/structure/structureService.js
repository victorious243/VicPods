const VALID_EPISODE_TYPES = ['solo', 'interview'];
const VALID_TARGET_LENGTHS = ['10-15', '20-30', '45+', ''];

const CTA_STYLE_OPTIONS = [
  {
    value: 'direct_action',
    label: 'Direct Action',
    description: 'End with one concrete next step listeners should complete.',
  },
  {
    value: 'reflection_prompt',
    label: 'Reflection Prompt',
    description: 'Close by making listeners think and self-assess first.',
  },
  {
    value: 'community_invite',
    label: 'Community Invite',
    description: 'Drive the audience to comment, reply, or share their take.',
  },
  {
    value: 'soft_pitch',
    label: 'Soft Pitch',
    description: 'Move naturally into a soft offer, resource, or next step.',
  },
];

const FORMAT_TEMPLATE_OPTIONS = [
  {
    value: 'signature_framework',
    label: 'Signature Framework',
    description: 'Teach one repeatable framework from pain point to action.',
    flow: ['Hook', 'Context', 'Framework', 'Example', 'Action', 'Outro'],
  },
  {
    value: 'story_to_strategy',
    label: 'Story to Strategy',
    description: 'Open with a story, then turn it into a practical method.',
    flow: ['Scene', 'Meaning', 'Lesson', 'Breakdown', 'Action', 'Outro'],
  },
  {
    value: 'interview_extraction',
    label: 'Interview Extraction',
    description: 'Pull the best insight out of a guest and make it usable.',
    flow: ['Guest Hook', 'Context', 'Insight', 'Example', 'Action', 'Outro'],
  },
  {
    value: 'myth_buster',
    label: 'Myth Buster',
    description: 'Challenge a common belief and replace it with a better model.',
    flow: ['Myth', 'Why It Fails', 'Better Model', 'Example', 'Action', 'Outro'],
  },
];

const HOOK_STYLE_OPTIONS = [
  {
    value: 'problem_first',
    label: 'Problem First',
    description: 'Lead with the pain, friction, or listener mistake.',
  },
  {
    value: 'bold_claim',
    label: 'Bold Claim',
    description: 'Open with a strong point of view that demands attention.',
  },
  {
    value: 'story_scene',
    label: 'Story Scene',
    description: 'Start with a short scene or moment to create tension.',
  },
  {
    value: 'question_led',
    label: 'Question Led',
    description: 'Use a sharp question to trigger curiosity and reflection.',
  },
  {
    value: 'myth_break',
    label: 'Myth Break',
    description: 'Call out a false assumption and replace it quickly.',
  },
];

const TARGET_LENGTH_OPTIONS = [
  {
    value: '',
    label: 'Flexible',
    presetLabel: 'Flexible',
    description: 'Let VicPods size the structure around the topic naturally.',
    timingPlan: ['Open', 'Build', 'Core A', 'Core B', 'Action', 'Close'],
  },
  {
    value: '10-15',
    label: 'Quick Hit (10-15 min)',
    presetLabel: 'Quick Hit',
    description: 'Compact, sharp, high-clarity delivery around one core outcome.',
    timingPlan: ['0:00-0:45', '0:45-2:30', '2:30-6:30', '6:30-8:30', '8:30-9:30', '9:30-10:15'],
  },
  {
    value: '20-30',
    label: 'Signature Episode (20-30 min)',
    presetLabel: 'Signature',
    description: 'Balanced structure with room for depth, proof, and action.',
    timingPlan: ['0:00-1:30', '1:30-5:00', '5:00-12:00', '12:00-20:00', '20:00-24:00', '24:00-26:00'],
  },
  {
    value: '45+',
    label: 'Deep Dive (45+ min)',
    presetLabel: 'Deep Dive',
    description: 'Extended authority episode with richer explanation and examples.',
    timingPlan: ['0:00-2:00', '2:00-8:00', '8:00-20:00', '20:00-36:00', '36:00-42:00', '42:00-45:00+'],
  },
];

const CTA_STYLE_VALUES = CTA_STYLE_OPTIONS.map((option) => option.value);
const FORMAT_TEMPLATE_VALUES = FORMAT_TEMPLATE_OPTIONS.map((option) => option.value);
const HOOK_STYLE_VALUES = HOOK_STYLE_OPTIONS.map((option) => option.value);

const DEFAULT_CTA_STYLE = 'direct_action';
const DEFAULT_FORMAT_TEMPLATE = 'signature_framework';
const DEFAULT_HOOK_STYLE = 'problem_first';

const EPISODE_TYPE_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'interview', label: 'Interview' },
];

function unwrapValue(value) {
  return Array.isArray(value) ? value[value.length - 1] : value;
}

function cleanText(value, maxLength) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeSelect(value, allowedValues, fallback) {
  const normalized = String(unwrapValue(value) || '').trim();
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function readSubmittedValue(body, key, fallback) {
  return Object.prototype.hasOwnProperty.call(body, key) ? body[key] : fallback;
}

function normalizeEpisodeType(value) {
  return normalizeSelect(value, VALID_EPISODE_TYPES, 'solo');
}

function normalizeTargetLength(value) {
  return normalizeSelect(value, VALID_TARGET_LENGTHS, '');
}

function normalizeIncludeFunSegment(value, fallback = true) {
  const normalized = unwrapValue(value);

  if (typeof normalized === 'undefined' || normalized === null || normalized === '') {
    return fallback;
  }

  return normalized === true || normalized === 'true' || normalized === 'on';
}

function normalizeList(value, { maxItems = 6, maxLength = 120 } = {}) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/\n|,/);

  return [...new Set(source
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean))]
    .slice(0, maxItems);
}

function getFormatTemplateOption(value) {
  return FORMAT_TEMPLATE_OPTIONS.find((option) => option.value === value) || FORMAT_TEMPLATE_OPTIONS[0];
}

function getHookStyleOption(value) {
  return HOOK_STYLE_OPTIONS.find((option) => option.value === value) || HOOK_STYLE_OPTIONS[0];
}

function getTargetLengthOption(value) {
  return TARGET_LENGTH_OPTIONS.find((option) => option.value === value) || TARGET_LENGTH_OPTIONS[0];
}

function getCtaStyleOption(value) {
  return CTA_STYLE_OPTIONS.find((option) => option.value === value) || CTA_STYLE_OPTIONS[0];
}

function resolveShowBlueprint(source = {}) {
  const blueprint = source?.showBlueprint || source || {};

  return {
    audienceProblem: cleanText(blueprint.audienceProblem, 240),
    listenerTransformation: cleanText(blueprint.listenerTransformation, 240),
    contentPillars: normalizeList(blueprint.contentPillars, { maxItems: 6, maxLength: 80 }),
    ctaStyle: normalizeSelect(blueprint.ctaStyle, CTA_STYLE_VALUES, DEFAULT_CTA_STYLE),
    bannedWords: normalizeList(blueprint.bannedWords, { maxItems: 10, maxLength: 40 }),
    brandVoiceRules: normalizeList(blueprint.brandVoiceRules, { maxItems: 6, maxLength: 120 }),
  };
}

function hasShowBlueprintData(source = {}) {
  const blueprint = resolveShowBlueprint(source);

  return Boolean(
    blueprint.audienceProblem
    || blueprint.listenerTransformation
    || blueprint.contentPillars.length
    || blueprint.bannedWords.length
    || blueprint.brandVoiceRules.length
  );
}

function normalizeShowBlueprintInput(body = {}, fallback = {}) {
  const current = resolveShowBlueprint(fallback);

  return {
    audienceProblem: cleanText(readSubmittedValue(body, 'audienceProblem', current.audienceProblem), 240),
    listenerTransformation: cleanText(readSubmittedValue(body, 'listenerTransformation', current.listenerTransformation), 240),
    contentPillars: normalizeList(readSubmittedValue(body, 'contentPillars', current.contentPillars), { maxItems: 6, maxLength: 80 }),
    ctaStyle: normalizeSelect(readSubmittedValue(body, 'ctaStyle', current.ctaStyle), CTA_STYLE_VALUES, current.ctaStyle || DEFAULT_CTA_STYLE),
    bannedWords: normalizeList(readSubmittedValue(body, 'bannedWords', current.bannedWords), { maxItems: 10, maxLength: 40 }),
    brandVoiceRules: normalizeList(readSubmittedValue(body, 'brandVoiceRules', current.brandVoiceRules), { maxItems: 6, maxLength: 120 }),
  };
}

function resolveSeriesStructureDefaults(source = {}) {
  return {
    defaultEpisodeType: normalizeEpisodeType(source.defaultEpisodeType),
    defaultTargetLength: normalizeTargetLength(source.defaultTargetLength),
    defaultIncludeFunSegment: typeof source.defaultIncludeFunSegment === 'boolean'
      ? source.defaultIncludeFunSegment
      : true,
    defaultFormatTemplate: normalizeSelect(source.defaultFormatTemplate, FORMAT_TEMPLATE_VALUES, DEFAULT_FORMAT_TEMPLATE),
    defaultHookStyle: normalizeSelect(source.defaultHookStyle, HOOK_STYLE_VALUES, DEFAULT_HOOK_STYLE),
  };
}

function normalizeSeriesStructureInput(body = {}, fallback = {}) {
  const current = resolveSeriesStructureDefaults(fallback);

  return {
    defaultEpisodeType: normalizeEpisodeType(readSubmittedValue(body, 'defaultEpisodeType', readSubmittedValue(body, 'episodeType', current.defaultEpisodeType))),
    defaultTargetLength: normalizeTargetLength(readSubmittedValue(body, 'defaultTargetLength', readSubmittedValue(body, 'targetLength', current.defaultTargetLength))),
    defaultIncludeFunSegment: normalizeIncludeFunSegment(
      readSubmittedValue(
        body,
        'defaultIncludeFunSegment',
        Object.prototype.hasOwnProperty.call(body, 'includeFunSegment')
          ? body.includeFunSegment
          : current.defaultIncludeFunSegment
      ),
      Object.prototype.hasOwnProperty.call(body, 'includeFunSegment')
        ? normalizeIncludeFunSegment(body.includeFunSegment, current.defaultIncludeFunSegment)
        : current.defaultIncludeFunSegment
    ),
    defaultFormatTemplate: normalizeSelect(
      readSubmittedValue(body, 'defaultFormatTemplate', readSubmittedValue(body, 'formatTemplate', current.defaultFormatTemplate)),
      FORMAT_TEMPLATE_VALUES,
      current.defaultFormatTemplate
    ),
    defaultHookStyle: normalizeSelect(
      readSubmittedValue(body, 'defaultHookStyle', readSubmittedValue(body, 'hookStyle', current.defaultHookStyle)),
      HOOK_STYLE_VALUES,
      current.defaultHookStyle
    ),
  };
}

function resolveEpisodeStructureSettings(source = {}) {
  return {
    episodeType: normalizeEpisodeType(source.episodeType),
    targetLength: normalizeTargetLength(source.targetLength),
    includeFunSegment: typeof source.includeFunSegment === 'boolean'
      ? source.includeFunSegment
      : true,
    formatTemplate: normalizeSelect(source.formatTemplate, FORMAT_TEMPLATE_VALUES, DEFAULT_FORMAT_TEMPLATE),
    hookStyle: normalizeSelect(source.hookStyle, HOOK_STYLE_VALUES, DEFAULT_HOOK_STYLE),
  };
}

function normalizeEpisodeStructureInput(body = {}, fallback = {}) {
  const current = resolveEpisodeStructureSettings(fallback);

  return {
    episodeType: normalizeEpisodeType(readSubmittedValue(body, 'episodeType', current.episodeType)),
    targetLength: normalizeTargetLength(readSubmittedValue(body, 'targetLength', current.targetLength)),
    includeFunSegment: normalizeIncludeFunSegment(readSubmittedValue(body, 'includeFunSegment', current.includeFunSegment), current.includeFunSegment),
    formatTemplate: normalizeSelect(readSubmittedValue(body, 'formatTemplate', current.formatTemplate), FORMAT_TEMPLATE_VALUES, current.formatTemplate),
    hookStyle: normalizeSelect(readSubmittedValue(body, 'hookStyle', current.hookStyle), HOOK_STYLE_VALUES, current.hookStyle),
  };
}

function resolveEffectiveShowBlueprint({ series, episode }) {
  if (episode && hasShowBlueprintData(episode)) {
    return resolveShowBlueprint(episode);
  }

  return resolveShowBlueprint(series);
}

function resolveEffectiveStructure({ series, episode }) {
  const seriesDefaults = resolveSeriesStructureDefaults(series);

  const structure = {
    episodeType: episode?.episodeType || seriesDefaults.defaultEpisodeType,
    targetLength: typeof episode?.targetLength === 'string'
      ? normalizeTargetLength(episode.targetLength)
      : seriesDefaults.defaultTargetLength,
    includeFunSegment: typeof episode?.includeFunSegment === 'boolean'
      ? episode.includeFunSegment
      : seriesDefaults.defaultIncludeFunSegment,
    formatTemplate: episode?.formatTemplate || seriesDefaults.defaultFormatTemplate,
    hookStyle: episode?.hookStyle || seriesDefaults.defaultHookStyle,
  };

  return {
    ...structure,
    formatTemplateMeta: getFormatTemplateOption(structure.formatTemplate),
    hookStyleMeta: getHookStyleOption(structure.hookStyle),
    targetLengthMeta: getTargetLengthOption(structure.targetLength),
  };
}

module.exports = {
  CTA_STYLE_OPTIONS,
  CTA_STYLE_VALUES,
  DEFAULT_CTA_STYLE,
  DEFAULT_FORMAT_TEMPLATE,
  DEFAULT_HOOK_STYLE,
  EPISODE_TYPE_OPTIONS,
  FORMAT_TEMPLATE_OPTIONS,
  FORMAT_TEMPLATE_VALUES,
  HOOK_STYLE_OPTIONS,
  HOOK_STYLE_VALUES,
  TARGET_LENGTH_OPTIONS,
  VALID_EPISODE_TYPES,
  VALID_TARGET_LENGTHS,
  getCtaStyleOption,
  getFormatTemplateOption,
  getHookStyleOption,
  getTargetLengthOption,
  hasShowBlueprintData,
  normalizeEpisodeStructureInput,
  normalizeEpisodeType,
  normalizeIncludeFunSegment,
  normalizeSeriesStructureInput,
  normalizeShowBlueprintInput,
  normalizeTargetLength,
  resolveEffectiveShowBlueprint,
  resolveEffectiveStructure,
  resolveSeriesStructureDefaults,
  resolveShowBlueprint,
};
