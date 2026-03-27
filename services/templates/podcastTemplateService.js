const fs = require('fs');
const path = require('path');
const { TONE_PRESET_NAMES } = require('../tone/tonePresets');
const {
  CTA_STYLE_OPTIONS,
  CTA_STYLE_VALUES,
  DEFAULT_CTA_STYLE,
  FORMAT_TEMPLATE_OPTIONS,
  FORMAT_TEMPLATE_VALUES,
  HOOK_STYLE_OPTIONS,
  HOOK_STYLE_VALUES,
  TARGET_LENGTH_OPTIONS,
  VALID_EPISODE_TYPES,
  VALID_TARGET_LENGTHS,
} = require('../structure/structureService');
const {
  DEFAULT_DELIVERY_STYLE,
  DELIVERY_STYLE_OPTIONS,
  DELIVERY_STYLE_VALUES,
} = require('../writing/writingIntelligenceService');

const DEFAULT_PODCAST_TEMPLATE_KEY = 'solo_educator';
const TEMPLATE_FILES = ['solo.json', 'interview.json', 'storytelling.json', 'business.json', 'coaching.json'];
const templatesDir = path.join(__dirname, '..', '..', 'templates');

const TEMPLATE_ICONS = {
  solo_educator: {
    viewBox: '0 0 24 24',
    paths: [
      'M5 6.5A2.5 2.5 0 0 1 7.5 4H19v14H7.5A2.5 2.5 0 0 0 5 20.5z',
      'M5 20.5V6.5',
      'M9 8h6',
      'M9 11h6',
    ],
  },
  interview_show: {
    viewBox: '0 0 24 24',
    paths: [
      'M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z',
      'M7 11a5 5 0 0 0 10 0',
      'M12 16v4',
      'M9 20h6',
    ],
  },
  storytelling: {
    viewBox: '0 0 24 24',
    paths: [
      'M12 4l1.8 4.2L18 10l-4.2 1.8L12 16l-1.8-4.2L6 10l4.2-1.8Z',
      'M18 17l.8 1.7L21 19.5l-2.2.8L18 22l-.8-1.7L15 19.5l2.2-.8Z',
    ],
  },
  business_podcast: {
    viewBox: '0 0 24 24',
    paths: [
      'M4 20h16',
      'M7 20v-8',
      'M12 20V8',
      'M17 20V5',
    ],
  },
  coaching_personal_brand: {
    viewBox: '0 0 24 24',
    paths: [
      'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
      'M15.5 8.5l-2.3 5.3-5.2 2.4 2.3-5.3z',
      'M13.2 13.8l2.3-5.3',
    ],
  },
};

const labelMap = (options, fallbackKey = 'label') => new Map(
  options.map((option) => [option.value, option[fallbackKey] || option.value])
);

const formatLabelByValue = labelMap(FORMAT_TEMPLATE_OPTIONS);
const hookLabelByValue = labelMap(HOOK_STYLE_OPTIONS);
const targetLengthLabelByValue = labelMap(TARGET_LENGTH_OPTIONS);
const deliveryLabelByValue = labelMap(DELIVERY_STYLE_OPTIONS);
const ctaLabelByValue = labelMap(CTA_STYLE_OPTIONS);

function cleanText(value, maxLength = 240) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanList(value, { maxItems = 8, maxLength = 60 } = {}) {
  const input = Array.isArray(value) ? value : [];
  return input
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function pickAllowed(value, allowedValues, fallback) {
  const normalized = cleanText(value, 80);
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeIntensity(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return 3;
  }

  return Math.min(5, Math.max(1, parsed));
}

function readTemplateFile(fileName) {
  const fullPath = path.join(templatesDir, fileName);
  const raw = fs.readFileSync(fullPath, 'utf8');
  return JSON.parse(raw);
}

function normalizeTemplate(rawTemplate) {
  const key = cleanText(rawTemplate.key, 80);
  if (!key) {
    throw new Error('Podcast template is missing a key.');
  }

  const episodeStructure = rawTemplate.episodeStructure || {};
  const tone = rawTemplate.tone || {};
  const showBlueprint = rawTemplate.showBlueprint || {};
  const normalizedEpisodeType = pickAllowed(episodeStructure.episodeType, VALID_EPISODE_TYPES, 'solo');
  const normalizedFormatTemplate = pickAllowed(
    episodeStructure.formatTemplate,
    FORMAT_TEMPLATE_VALUES,
    'signature_framework'
  );
  const normalizedHookStyle = pickAllowed(
    episodeStructure.hookStyle,
    HOOK_STYLE_VALUES,
    'problem_first'
  );
  const normalizedTargetLength = pickAllowed(
    episodeStructure.targetLength,
    VALID_TARGET_LENGTHS,
    '20-30'
  );
  const normalizedDeliveryStyle = pickAllowed(
    tone.deliveryStyle,
    DELIVERY_STYLE_VALUES,
    DEFAULT_DELIVERY_STYLE
  );
  const normalizedCtaStyle = pickAllowed(
    showBlueprint.ctaStyle,
    CTA_STYLE_VALUES,
    DEFAULT_CTA_STYLE
  );

  return {
    key,
    label: cleanText(rawTemplate.label || key, 80),
    description: cleanText(rawTemplate.description, 220),
    bestFor: cleanText(rawTemplate.bestFor, 180),
    promptHint: cleanText(rawTemplate.promptHint, 220),
    exampleTitle: cleanText(rawTemplate.exampleTitle, 160),
    exampleDescription: cleanText(rawTemplate.exampleDescription, 220),
    episodeStructure: {
      episodeType: normalizedEpisodeType,
      formatTemplate: normalizedFormatTemplate,
      hookStyle: normalizedHookStyle,
      targetLength: normalizedTargetLength,
      includeFunSegment: episodeStructure.includeFunSegment === true,
    },
    tone: {
      tonePreset: pickAllowed(tone.tonePreset, TONE_PRESET_NAMES, 'Conversational & Casual'),
      toneIntensity: normalizeIntensity(tone.toneIntensity),
      deliveryStyle: normalizedDeliveryStyle,
    },
    showBlueprint: {
      ctaStyle: normalizedCtaStyle,
    },
    sectionLabels: cleanList(rawTemplate.sectionLabels, { maxItems: 7, maxLength: 50 }),
    icon: TEMPLATE_ICONS[key] || TEMPLATE_ICONS[DEFAULT_PODCAST_TEMPLATE_KEY],
    preview: {
      episodeTypeLabel: normalizedEpisodeType === 'interview' ? 'Interview' : 'Solo',
      formatTemplateLabel: formatLabelByValue.get(normalizedFormatTemplate) || normalizedFormatTemplate,
      hookStyleLabel: hookLabelByValue.get(normalizedHookStyle) || normalizedHookStyle,
      targetLengthLabel: targetLengthLabelByValue.get(normalizedTargetLength) || 'Flexible',
      deliveryStyleLabel: deliveryLabelByValue.get(normalizedDeliveryStyle) || normalizedDeliveryStyle,
      ctaStyleLabel: ctaLabelByValue.get(normalizedCtaStyle) || normalizedCtaStyle,
    },
  };
}

const PODCAST_TEMPLATES = TEMPLATE_FILES.map(readTemplateFile).map(normalizeTemplate);
const PODCAST_TEMPLATE_MAP = new Map(PODCAST_TEMPLATES.map((template) => [template.key, template]));

function getPodcastTemplate(key) {
  const normalizedKey = cleanText(key, 80);
  return PODCAST_TEMPLATE_MAP.get(normalizedKey) || PODCAST_TEMPLATE_MAP.get(DEFAULT_PODCAST_TEMPLATE_KEY);
}

function getPodcastTemplates() {
  return PODCAST_TEMPLATES.map((template) => ({
    ...template,
    episodeStructure: { ...template.episodeStructure },
    tone: { ...template.tone },
    showBlueprint: { ...template.showBlueprint },
    sectionLabels: [...template.sectionLabels],
    icon: template.icon ? { ...template.icon, paths: [...template.icon.paths] } : null,
    preview: { ...template.preview },
  }));
}

function buildSingleTemplateDefaults(templateInput, { maxToneIntensity = 3 } = {}) {
  const template = getPodcastTemplate(templateInput);
  return {
    templateType: template.key,
    tonePreset: template.tone.tonePreset,
    toneIntensity: Math.min(maxToneIntensity, template.tone.toneIntensity),
    deliveryStyle: template.tone.deliveryStyle,
    episodeType: template.episodeStructure.episodeType,
    targetLength: template.episodeStructure.targetLength,
    includeFunSegment: template.episodeStructure.includeFunSegment,
    formatTemplate: template.episodeStructure.formatTemplate,
    hookStyle: template.episodeStructure.hookStyle,
    ctaStyle: template.showBlueprint.ctaStyle,
    titlePlaceholder: template.exampleTitle || 'How to Launch Your Podcast in 30 Days',
    descriptionPlaceholder: template.exampleDescription || '1-2 lines on what this episode should deliver',
  };
}

function buildPodcastTemplateClientPayload(templatesInput, { maxToneIntensity = 3 } = {}) {
  const templates = Array.isArray(templatesInput) && templatesInput.length
    ? templatesInput
    : getPodcastTemplates();

  return templates.map((template) => ({
    key: template.key,
    label: template.label,
    description: template.description,
    bestFor: template.bestFor,
    promptHint: template.promptHint,
    exampleTitle: template.exampleTitle,
    exampleDescription: template.exampleDescription,
    episodeStructure: { ...template.episodeStructure },
    tone: {
      ...template.tone,
      toneIntensity: Math.min(maxToneIntensity, template.tone.toneIntensity),
    },
    showBlueprint: { ...template.showBlueprint },
    sectionLabels: [...template.sectionLabels],
    preview: { ...template.preview },
  }));
}

module.exports = {
  DEFAULT_PODCAST_TEMPLATE_KEY,
  PODCAST_TEMPLATE_KEYS: PODCAST_TEMPLATES.map((template) => template.key),
  buildPodcastTemplateClientPayload,
  buildSingleTemplateDefaults,
  getPodcastTemplate,
  getPodcastTemplates,
};
