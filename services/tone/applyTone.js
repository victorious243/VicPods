const { TONE_PRESET_MAP } = require('./tonePresets');

function clampIntensity(rawValue, max = 5, fallback = 3) {
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed)) {
    return Math.min(Math.max(fallback, 1), max);
  }
  return Math.min(Math.max(parsed, 1), max);
}

function buildIntensityGuidelines(intensity) {
  if (intensity <= 1) {
    return 'Subtle expression. Keep signals light and understated.';
  }

  if (intensity === 2) {
    return 'Gentle expression. Keep style present but not dominant.';
  }

  if (intensity === 3) {
    return 'Balanced expression. Keep style clear and consistent.';
  }

  if (intensity === 4) {
    return 'Strong expression. Make style obvious without becoming repetitive.';
  }

  return 'Maximum expression. Make style highly recognizable while preserving clarity.';
}

function getTonePresetOrDefault(name) {
  if (name && TONE_PRESET_MAP.has(name)) {
    return TONE_PRESET_MAP.get(name);
  }

  return TONE_PRESET_MAP.get('Conversational & Casual');
}

function buildToneBlock({
  tonePreset,
  toneIntensity,
  audienceType,
  intent,
  voicePersona,
}) {
  const preset = getTonePresetOrDefault(tonePreset);
  const intensity = clampIntensity(toneIntensity, 5, 3);
  const intentValue = String(intent || 'educate');
  const audienceValue = String(audienceType || 'mixed').trim() || 'mixed';
  const personaText = String(voicePersona || '').trim();

  const lines = [
    'Tone Engine:',
    `- Tone Preset: ${preset.name}`,
    `- Preset Description: ${preset.description}`,
    `- Example Hook Style: ${preset.exampleHook}`,
    `- Tone Intensity: ${intensity}/5`,
    `- Intensity Guidance: ${buildIntensityGuidelines(intensity)}`,
    '- Behavioral Rules:',
    ...preset.styleRules.map((rule) => `  - ${rule}`),
    '- Section Rules:',
    '  - Hook: must reflect tone immediately in first line.',
    '  - Pacing: match sentence rhythm to tone intensity.',
    '  - Vocabulary: pick words that fit preset; avoid drift.',
    '  - Host Questions: style of questions must match tone.',
    '  - Ending: must sound like the same host voice and include teaser.',
    `- Audience Type: ${audienceValue}`,
    `- Intent: ${intentValue}`,
  ];

  if (personaText) {
    lines.push('- Voice Persona (Premium):');
    lines.push(`  - ${personaText}`);
    lines.push('  - Apply persona to rhythm and wording, never to structure length.');
  }

  return {
    tonePreset: preset.name,
    toneIntensity: intensity,
    toneBlock: lines.join('\n'),
  };
}

module.exports = {
  clampIntensity,
  getTonePresetOrDefault,
  buildToneBlock,
};
