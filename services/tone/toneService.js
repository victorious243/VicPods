const { clampIntensity, getTonePresetOrDefault } = require('./applyTone');
const { TONE_PRESET_NAMES } = require('./tonePresets');

const INTENT_OPTIONS = ['educate', 'inspire', 'debate', 'storytell', 'entertain'];
const AUDIENCE_TYPES = ['Beginner', 'Expert', 'Mixed', 'Custom'];

const LEGACY_TONE_TO_PRESET = {
  fun: 'Conversational & Casual',
  calm: 'Calm & Reflective',
  serious: 'Professional & Corporate',
};

function getMaxIntensityForPlan(plan) {
  return plan === 'free' ? 3 : 5;
}

function normalizeAudienceType(body) {
  const selected = String(body.audienceType || '').trim();
  const custom = String(body.audienceTypeCustom || '').trim();

  if (selected === 'Custom') {
    return custom || 'Mixed';
  }

  if (selected) {
    return selected;
  }

  return custom || '';
}

function normalizeIntent(intent) {
  const value = String(intent || '').trim().toLowerCase();
  return INTENT_OPTIONS.includes(value) ? value : 'educate';
}

function normalizeSeriesToneInput(body, plan) {
  const maxIntensity = getMaxIntensityForPlan(plan);
  const preset = getTonePresetOrDefault(body.tonePreset).name;

  return {
    tonePreset: preset,
    toneIntensity: clampIntensity(body.toneIntensity, maxIntensity, 3),
    audienceType: normalizeAudienceType(body),
    intent: normalizeIntent(body.intent),
    voicePersona: plan === 'premium'
      ? String(body.voicePersona || '').trim().slice(0, 400)
      : '',
  };
}

function normalizeEpisodeToneOverride(body, { series, plan }) {
  const overrideEnabled = body.toneOverrideEnabled === 'on';
  if (!overrideEnabled) {
    return {
      toneOverridePreset: '',
      toneOverrideIntensity: null,
      toneOverrideEnabled: false,
    };
  }

  const maxIntensity = getMaxIntensityForPlan(plan);
  const preset = getTonePresetOrDefault(body.toneOverridePreset || series.tonePreset).name;

  return {
    toneOverridePreset: preset,
    toneOverrideIntensity: clampIntensity(body.toneOverrideIntensity, maxIntensity, series.toneIntensity || 3),
    toneOverrideEnabled: true,
  };
}

function resolveEffectiveTone({ series, episode, includePersona = true, plan = 'free' }) {
  const hasOverride = Boolean(episode && episode.toneOverridePreset);
  const tonePreset = hasOverride ? episode.toneOverridePreset : series.tonePreset;
  const toneIntensity = hasOverride
    ? (episode.toneOverrideIntensity || series.toneIntensity || 3)
    : (series.toneIntensity || 3);
  const maxIntensity = getMaxIntensityForPlan(plan);

  return {
    tonePreset: getTonePresetOrDefault(tonePreset).name,
    toneIntensity: clampIntensity(toneIntensity, maxIntensity, 3),
    toneSource: hasOverride ? 'override' : 'inherited',
    audienceType: series.audienceType || '',
    intent: normalizeIntent(series.intent),
    voicePersona: includePersona && plan === 'premium' ? String(series.voicePersona || '').trim() : '',
  };
}

async function ensureSeriesToneDefaults(series) {
  if (!series) {
    return null;
  }

  let changed = false;

  if (!series.tonePreset) {
    const fallback = LEGACY_TONE_TO_PRESET[series.tone] || 'Conversational & Casual';
    series.tonePreset = fallback;
    changed = true;
  }

  if (!series.toneIntensity) {
    series.toneIntensity = 3;
    changed = true;
  }

  if (typeof series.audienceType === 'undefined') {
    series.audienceType = '';
    changed = true;
  }

  if (!series.intent) {
    series.intent = 'educate';
    changed = true;
  }

  if (typeof series.voicePersona === 'undefined') {
    series.voicePersona = '';
    changed = true;
  }

  if (changed) {
    await series.save();
  }

  return series;
}

module.exports = {
  INTENT_OPTIONS,
  AUDIENCE_TYPES,
  TONE_PRESET_NAMES,
  getMaxIntensityForPlan,
  normalizeSeriesToneInput,
  normalizeEpisodeToneOverride,
  resolveEffectiveTone,
  ensureSeriesToneDefaults,
};
