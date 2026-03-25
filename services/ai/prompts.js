const { buildToneBlock } = require('../tone/applyTone');
const { resolveAiLanguageName } = require('../i18n/languageService');
const {
  getCtaStyleOption,
  resolveEffectiveShowBlueprint,
  resolveEffectiveStructure,
} = require('../structure/structureService');
const { resolveSeriesBible } = require('../series/seriesPlanningService');
const {
  getDeliveryStyleOption,
  resolveEffectiveDeliveryStyle,
} = require('../writing/writingIntelligenceService');

function resolveToneInput(series, effectiveTone = {}) {
  return buildToneBlock({
    tonePreset: effectiveTone.tonePreset || series.tonePreset,
    toneIntensity: effectiveTone.toneIntensity || series.toneIntensity || 3,
    audienceType: effectiveTone.audienceType || series.audienceType || 'Mixed',
    intent: effectiveTone.intent || series.intent || 'educate',
    voicePersona: effectiveTone.voicePersona || '',
  });
}

function buildStructureBlock({ series, episode }) {
  const blueprint = resolveEffectiveShowBlueprint({ series, episode });
  const seriesBible = resolveSeriesBible(series);
  const structure = resolveEffectiveStructure({ series, episode });
  const ctaStyle = getCtaStyleOption(blueprint.ctaStyle);
  const deliveryStyle = getDeliveryStyleOption(resolveEffectiveDeliveryStyle({ series, episode }));

  return [
    'VicPods Structuring Application:',
    `Format Template: ${structure.formatTemplateMeta.label} - ${structure.formatTemplateMeta.description}`,
    `Architected Flow: ${(structure.formatTemplateMeta.flow || []).join(' -> ')}`,
    `Hook Style: ${structure.hookStyleMeta.label} - ${structure.hookStyleMeta.description}`,
    `Duration Preset: ${structure.targetLengthMeta.label} - ${structure.targetLengthMeta.description}`,
    `Timing Guide: ${(structure.targetLengthMeta.timingPlan || []).join(' | ')}`,
    `Delivery Style: ${deliveryStyle.label} - ${deliveryStyle.promptHint}`,
    `Season Goal: ${seriesBible.seasonGoal || series.goal || 'Advance the season toward a concrete outcome.'}`,
    `Audience Promise: ${seriesBible.audiencePromise || blueprint.listenerTransformation || 'Leave listeners better than they arrived.'}`,
    `Recurring Themes: ${seriesBible.recurringThemes.join(' | ') || blueprint.contentPillars.join(' | ') || 'Keep thematic continuity consistent.'}`,
    `Audience Problem: ${blueprint.audienceProblem || series.audience || 'Creators need a clearer path from idea to strong episodes.'}`,
    `Listener Transformation: ${blueprint.listenerTransformation || series.goal || 'Leave with one clear decision and one action.'}`,
    `Content Pillars: ${blueprint.contentPillars.join(' | ') || 'Use the strongest available pillar and stay focused.'}`,
    `CTA Style: ${ctaStyle.label} - ${ctaStyle.description}`,
    `Banned Words/Phrases: ${blueprint.bannedWords.join(' | ') || 'None specified.'}`,
    `Brand Voice Rules: ${blueprint.brandVoiceRules.join(' | ') || 'Keep the language specific, practical, and structured.'}`,
  ].join('\n');
}

function buildEpisodeGenerationPrompt(input) {
  const {
    language,
    series,
    theme,
    episode,
    episodeNumberWithinTheme,
    globalEpisodeNumber,
    previousEpisodeEndState,
    existingEpisodeTitles,
    ingredientHooks,
    existingTitle,
    effectiveTone,
    callbackSuggestions,
    continuityWarnings,
    seasonArcStep,
    episodeType,
    targetLength,
    includeFunSegment,
    isStandalone,
    requireTeaser,
  } = input;

  const tone = resolveToneInput(series, effectiveTone);
  const outputLanguage = resolveAiLanguageName(language);
  const structureBlock = buildStructureBlock({ series, episode });
  const structure = resolveEffectiveStructure({ series, episode });

  return [
    'You are Chef AI for VicPods, an AI Podcast Director.',
    'Generate compact, production-ready episode drafts that guide creators to successful podcast outcomes.',
    `Output language: ${outputLanguage}. All JSON text fields must use this language.`,
    'Rules:',
    '- Every episode must move the series toward a concrete success goal.',
    '- Keep output concise and structured. Never ramble.',
    isStandalone
      ? '- This is a standalone episode. Do not rely on prior episode continuity.'
      : '- Primary continuity is within the SAME theme only.',
    isStandalone
      ? '- End with strong closure and actionable takeaway.'
      : '- If this is the first episode in the theme, rely on seriesSummary + themeSummary.',
    isStandalone
      ? '- Do not write a teaser for next episode.'
      : '- Avoid repeating old episode content in this theme.',
    requireTeaser === false
      ? '- Ending must NOT include teaser language.'
      : '- Move continuity forward and end with a clear takeaway + teaser.',
    '',
    `Series Name: ${series.name}`,
    `Series Description: ${series.description || 'N/A'}`,
    `Target Audience Notes: ${series.audience || 'General'}`,
    `Primary Goal: ${series.goal || 'Create a successful podcast plan with clear listener value and growth milestones.'}`,
    `Series Summary: ${series.seriesSummary || 'No summary yet.'}`,
    `Theme Name: ${theme.name}`,
    `Theme Description: ${theme.description || 'N/A'}`,
    `Theme Summary: ${theme.themeSummary || 'No theme summary yet.'}`,
    `Episode Number Within Theme: ${episodeNumberWithinTheme}`,
    `Global Episode Number (series-wide): ${globalEpisodeNumber || 'N/A'}`,
    `Episode Type: ${episodeType || structure.episodeType || 'solo'}`,
    `Target Length: ${targetLength || structure.targetLength || 'flexible'}`,
    `Include Fun Segment: ${includeFunSegment === false ? 'No' : (structure.includeFunSegment === false ? 'No' : 'Yes')}`,
    `Mode: ${isStandalone ? 'Standalone single episode' : 'Series continuity episode'}`,
    `Existing Title (optional): ${existingTitle || 'N/A'}`,
    `Previous Theme Episode End State: ${previousEpisodeEndState || 'No previous episode in this theme.'}`,
    `Already Covered Theme Episode Titles: ${(existingEpisodeTitles || []).join(', ') || 'None yet.'}`,
    `Pantry Ingredient Hooks: ${(ingredientHooks || []).join(' | ') || 'None selected.'}`,
    `Season Arc Position: ${seasonArcStep || 'No mapped season step yet.'}`,
    `Continuity Warnings: ${(continuityWarnings || []).join(' | ') || 'No continuity warnings.'}`,
    `Callback Suggestions: ${(callbackSuggestions || []).join(' | ') || 'No callback suggestion yet.'}`,
    '',
    tone.toneBlock,
    '',
    structureBlock,
    '',
    'Goal fit requirements:',
    '- Hook: follow the selected hook style and connect audience pain to a measurable outcome.',
    requireTeaser === false
      ? '- Outline: follow the architected flow and timing guide, then close without teaser language.'
      : '- Outline: follow the architected flow and timing guide, then preserve teaser momentum.',
    '- Talking points: include concrete execution and one metric checkpoint.',
    '- Host questions: force decisions, not generic brainstorming.',
    '- Use the selected content pillars and listener transformation as the strategic spine.',
    '- Advance the season goal and keep the audience promise visible in the draft.',
    '- Avoid repeating angles already flagged by continuity warnings.',
    '- If callback suggestions exist, weave one callback naturally into the outline or talking points.',
    '- CTA and ending must follow the selected CTA style.',
    '- Do not use banned words or phrases.',
    '- Respect the brand voice rules in phrasing and framing.',
    includeFunSegment === false
      ? '- Fun segment: return an empty string for funSegment.'
      : '- Fun segment: keep brief and aligned to theme objective.',
    requireTeaser === false
      ? '- Ending: one action for listeners this week and close clearly without teaser.'
      : '- Ending: one action for listeners this week and one teaser for next episode.',
    '',
    'Return valid JSON only with keys:',
    'title, hook, outline, talkingPoints, hostQuestions, funSegment, ending, endState, seriesSummary, themeSummary',
    'Constraints:',
    '- hook: 1-2 lines',
    '- outline: max 7 bullets',
    '- talkingPoints: max 7 bullets',
    '- hostQuestions: max 8 bullets',
    '- funSegment: one short game/dilemma',
    requireTeaser === false
      ? '- ending: 1-2 lines (clear closure, no teaser)'
      : '- ending: 1-2 lines (takeaway + teaser)',
    '- endState: max 80 words',
    '- seriesSummary: max 120 words',
    '- themeSummary: max 120 words',
  ].join('\n');
}

function buildSpicesPrompt(input) {
  const {
    language,
    series,
    theme,
    episode,
    episodeNumberWithinTheme,
    currentHook,
    existingTalkingPoints,
    previousEpisodeEndState,
    effectiveTone,
    callbackSuggestions,
    continuityWarnings,
    seasonArcStep,
    episodeType,
    targetLength,
    includeFunSegment,
    isStandalone,
    requireTeaser,
  } = input;

  const tone = resolveToneInput(series, effectiveTone);
  const outputLanguage = resolveAiLanguageName(language);
  const structureBlock = buildStructureBlock({ series, episode });
  const structure = resolveEffectiveStructure({ series, episode });

  return [
    'You are Chef AI for VicPods. Regenerate ONLY spices for this episode.',
    `Output language: ${outputLanguage}. All JSON text fields must use this language.`,
    'Return valid JSON with keys: hook, hostQuestions, funSegment.',
    'Keep concise. Keep continuity inside this theme and avoid repetition.',
    'Ensure each spice supports the series primary goal and the intended tone behavior.',
    `Series Name: ${series.name}`,
    `Primary Goal: ${series.goal || 'Create a successful podcast plan with repeatable growth.'}`,
    `Theme Name: ${theme.name}`,
    `Theme Summary: ${theme.themeSummary || 'N/A'}`,
    `Episode Number Within Theme: ${episodeNumberWithinTheme}`,
    `Episode Type: ${episodeType || structure.episodeType || 'solo'}`,
    `Target Length: ${targetLength || structure.targetLength || 'flexible'}`,
    `Include Fun Segment: ${includeFunSegment === false ? 'No' : (structure.includeFunSegment === false ? 'No' : 'Yes')}`,
    `Mode: ${isStandalone ? 'Standalone single episode' : 'Series continuity episode'}`,
    `Current Hook: ${currentHook || 'N/A'}`,
    `Existing Talking Points: ${(existingTalkingPoints || []).join(' | ') || 'N/A'}`,
    `Previous Theme Episode End State: ${previousEpisodeEndState || 'No previous episode in theme.'}`,
    `Season Arc Position: ${seasonArcStep || 'No mapped season step yet.'}`,
    `Continuity Warnings: ${(continuityWarnings || []).join(' | ') || 'No continuity warnings.'}`,
    `Callback Suggestions: ${(callbackSuggestions || []).join(' | ') || 'No callback suggestion yet.'}`,
    '',
    tone.toneBlock,
    '',
    structureBlock,
    '',
    'Requirements: hook must follow the selected hook style, support the listener transformation, respect banned words, and avoid repeated angles.',
    includeFunSegment === false
      ? 'Constraints: hook 1-2 lines; hostQuestions max 8 bullets; funSegment must be empty string.'
      : 'Constraints: hook 1-2 lines; hostQuestions max 8 bullets; funSegment one short game/dilemma.',
    requireTeaser === false
      ? 'Any ending implication in wording should be self-contained (no next-episode teaser language).'
      : 'Preserve continuity momentum toward the next episode.',
  ].join('\n');
}

function buildContinuityRefreshPrompt(input) {
  const {
    language,
    series,
    theme,
    episode,
    priorThemeEpisodes,
    effectiveTone,
  } = input;
  const tone = resolveToneInput(series, effectiveTone);
  const outputLanguage = resolveAiLanguageName(language);
  const structureBlock = buildStructureBlock({ series, episode });

  const priorLines = (priorThemeEpisodes || [])
    .map((item) => `E${item.episodeNumberWithinTheme}: ${item.title || 'Untitled'} | ${item.endState || item.ending || 'N/A'}`)
    .join('\n');

  return [
    'You are VicPods continuity editor.',
    `Output language: ${outputLanguage}. All JSON text fields must use this language.`,
    'Return valid JSON only with keys: seriesSummary, themeSummary, endState.',
    'seriesSummary max 120 words. themeSummary max 120 words. endState max 80 words.',
    'Summaries must track progress toward a successful podcast plan and preserve tone consistency.',
    `Series: ${series.name}`,
    `Series Description: ${series.description || 'N/A'}`,
    `Target Audience Notes: ${series.audience || 'N/A'}`,
    `Primary Goal: ${series.goal || 'Create a successful podcast plan with clear milestones.'}`,
    `Existing Series Summary: ${series.seriesSummary || 'N/A'}`,
    `Theme: ${theme.name}`,
    `Theme Description: ${theme.description || 'N/A'}`,
    `Existing Theme Summary: ${theme.themeSummary || 'N/A'}`,
    `Current Episode # (within theme): ${episode.episodeNumberWithinTheme}`,
    `Current Episode Title: ${episode.title || 'Untitled'}`,
    `Current Ending: ${episode.ending || 'N/A'}`,
    `Current Talking Points: ${(episode.talkingPoints || []).join(' | ') || 'N/A'}`,
    'Prior Theme Episode Context:',
    priorLines || 'No prior episodes in this theme.',
    '',
    tone.toneBlock,
    '',
    structureBlock,
  ].join('\n');
}

function buildToneFixPrompt(input) {
  const {
    language,
    series,
    theme,
    episode,
    effectiveTone,
    requireTeaser,
  } = input;
  const tone = resolveToneInput(series, effectiveTone);
  const outputLanguage = resolveAiLanguageName(language);
  const structureBlock = buildStructureBlock({ series, episode });

  return [
    'You are Chef AI Tone Director for VicPods.',
    `Output language: ${outputLanguage}. All JSON text fields must use this language.`,
    'Adjust tone consistency WITHOUT rewriting full episode structure.',
    'Return valid JSON only with keys: hook, hostQuestions, ending.',
    'Keep episode meaning and continuity stable.',
    requireTeaser === false
      ? 'Do not exceed these limits: hook 1-2 lines, hostQuestions max 8 bullets, ending 1-2 lines with strong closure and no teaser.'
      : 'Do not exceed these limits: hook 1-2 lines, hostQuestions max 8 bullets, ending 1-2 lines with teaser.',
    '',
    `Series: ${series.name}`,
    `Theme: ${theme.name}`,
    `Episode Number Within Theme: ${episode.episodeNumberWithinTheme}`,
    `Primary Goal: ${series.goal || 'N/A'}`,
    `Current Hook: ${episode.hook || 'N/A'}`,
    `Current Host Questions: ${(episode.hostQuestions || []).join(' | ') || 'N/A'}`,
    `Current Ending: ${episode.ending || 'N/A'}`,
    '',
    tone.toneBlock,
    '',
    structureBlock,
    '',
    'Preservation rules:',
    '- Keep the same core topic and learning objective.',
    '- Keep continuity with prior end state implied by current ending.',
    '- Improve style fit, clarity, and confidence.',
    '- Respect hook style, CTA style, banned words, and brand voice rules.',
    requireTeaser === false
      ? '- Ending must remain standalone and not reference a next episode.'
      : '- Ending should preserve teaser momentum for the next episode.',
  ].join('\n');
}

function buildShowNotesPrompt(input) {
  const {
    language,
    series,
    theme,
    episode,
    effectiveTone,
    seasonArcStep,
    continuityWarnings,
    callbackSuggestions,
  } = input;
  const tone = resolveToneInput(series, effectiveTone);
  const outputLanguage = resolveAiLanguageName(language);
  const structureBlock = buildStructureBlock({ series, episode });

  return [
    'You are Chef AI Launch Editor for VicPods.',
    `Output language: ${outputLanguage}. All JSON text fields must use this language.`,
    'Generate a compact Show Notes Pack for a podcast episode.',
    'Return valid JSON only with keys: summary, description, keyTakeaways, listenerCTA, socialPosts.',
    'Do not invent timestamps, analytics, guest quotes, or publishing claims.',
    'Use the existing episode structure only. Keep the result launch-ready and practical.',
    '',
    `Series: ${series.name}`,
    `Series Goal: ${series.goal || 'Create stronger podcast episodes with clear outcomes.'}`,
    `Theme: ${theme.name}`,
    `Theme Summary: ${theme.themeSummary || 'N/A'}`,
    `Episode Title: ${episode.title || 'Untitled'}`,
    `Episode Hook: ${episode.hook || 'N/A'}`,
    `Outline: ${(episode.outline || []).join(' | ') || 'N/A'}`,
    `Talking Points: ${(episode.talkingPoints || []).join(' | ') || 'N/A'}`,
    `Host Questions: ${(episode.hostQuestions || []).join(' | ') || 'N/A'}`,
    `Ending: ${episode.ending || 'N/A'}`,
    `Season Arc Position: ${seasonArcStep || 'No mapped season step yet.'}`,
    `Continuity Warnings: ${(continuityWarnings || []).join(' | ') || 'None.'}`,
    `Callback Suggestions: ${(callbackSuggestions || []).join(' | ') || 'None.'}`,
    '',
    tone.toneBlock,
    '',
    structureBlock,
    '',
    'Constraints:',
    '- summary: max 80 words',
    '- description: max 120 words',
    '- keyTakeaways: max 5 bullets, each concrete and practical',
    '- listenerCTA: 1-2 lines',
    '- socialPosts: exactly 3 short options, each ready to post',
    '- Respect banned words and brand voice rules.',
  ].join('\n');
}

module.exports = {
  buildEpisodeGenerationPrompt,
  buildSpicesPrompt,
  buildContinuityRefreshPrompt,
  buildToneFixPrompt,
  buildShowNotesPrompt,
};
