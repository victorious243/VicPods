const { buildToneBlock } = require('../tone/applyTone');

function resolveToneInput(series, effectiveTone = {}) {
  return buildToneBlock({
    tonePreset: effectiveTone.tonePreset || series.tonePreset,
    toneIntensity: effectiveTone.toneIntensity || series.toneIntensity || 3,
    audienceType: effectiveTone.audienceType || series.audienceType || 'Mixed',
    intent: effectiveTone.intent || series.intent || 'educate',
    voicePersona: effectiveTone.voicePersona || '',
  });
}

function buildEpisodeGenerationPrompt(input) {
  const {
    series,
    theme,
    episodeNumberWithinTheme,
    globalEpisodeNumber,
    previousEpisodeEndState,
    existingEpisodeTitles,
    ingredientHooks,
    existingTitle,
    effectiveTone,
    episodeType,
    targetLength,
    includeFunSegment,
    isStandalone,
    requireTeaser,
  } = input;

  const tone = resolveToneInput(series, effectiveTone);

  return [
    'You are Chef AI for VicPods, an AI Podcast Director.',
    'Generate compact, production-ready episode drafts that guide creators to successful podcast outcomes.',
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
    `Episode Type: ${episodeType || 'solo'}`,
    `Target Length: ${targetLength || 'flexible'}`,
    `Include Fun Segment: ${includeFunSegment === false ? 'No' : 'Yes'}`,
    `Mode: ${isStandalone ? 'Standalone single episode' : 'Series continuity episode'}`,
    `Existing Title (optional): ${existingTitle || 'N/A'}`,
    `Previous Theme Episode End State: ${previousEpisodeEndState || 'No previous episode in this theme.'}`,
    `Already Covered Theme Episode Titles: ${(existingEpisodeTitles || []).join(', ') || 'None yet.'}`,
    `Pantry Ingredient Hooks: ${(ingredientHooks || []).join(' | ') || 'None selected.'}`,
    '',
    tone.toneBlock,
    '',
    'Goal fit requirements:',
    '- Hook: connect audience pain to a measurable outcome.',
    requireTeaser === false
      ? '- Outline: progress context -> approach -> application -> outcome -> close.'
      : '- Outline: progress context -> approach -> application -> outcome -> teaser.',
    '- Talking points: include concrete execution and one metric checkpoint.',
    '- Host questions: force decisions, not generic brainstorming.',
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
    series,
    theme,
    episodeNumberWithinTheme,
    currentHook,
    existingTalkingPoints,
    previousEpisodeEndState,
    effectiveTone,
    episodeType,
    targetLength,
    includeFunSegment,
    isStandalone,
    requireTeaser,
  } = input;

  const tone = resolveToneInput(series, effectiveTone);

  return [
    'You are Chef AI for VicPods. Regenerate ONLY spices for this episode.',
    'Return valid JSON with keys: hook, hostQuestions, funSegment.',
    'Keep concise. Keep continuity inside this theme and avoid repetition.',
    'Ensure each spice supports the series primary goal and the intended tone behavior.',
    `Series Name: ${series.name}`,
    `Primary Goal: ${series.goal || 'Create a successful podcast plan with repeatable growth.'}`,
    `Theme Name: ${theme.name}`,
    `Theme Summary: ${theme.themeSummary || 'N/A'}`,
    `Episode Number Within Theme: ${episodeNumberWithinTheme}`,
    `Episode Type: ${episodeType || 'solo'}`,
    `Target Length: ${targetLength || 'flexible'}`,
    `Include Fun Segment: ${includeFunSegment === false ? 'No' : 'Yes'}`,
    `Mode: ${isStandalone ? 'Standalone single episode' : 'Series continuity episode'}`,
    `Current Hook: ${currentHook || 'N/A'}`,
    `Existing Talking Points: ${(existingTalkingPoints || []).join(' | ') || 'N/A'}`,
    `Previous Theme Episode End State: ${previousEpisodeEndState || 'No previous episode in theme.'}`,
    '',
    tone.toneBlock,
    '',
    includeFunSegment === false
      ? 'Constraints: hook 1-2 lines; hostQuestions max 8 bullets; funSegment must be empty string.'
      : 'Constraints: hook 1-2 lines; hostQuestions max 8 bullets; funSegment one short game/dilemma.',
    requireTeaser === false
      ? 'Any ending implication in wording should be self-contained (no next-episode teaser language).'
      : 'Preserve continuity momentum toward the next episode.',
  ].join('\n');
}

function buildContinuityRefreshPrompt(input) {
  const { series, theme, episode, priorThemeEpisodes, effectiveTone } = input;
  const tone = resolveToneInput(series, effectiveTone);

  const priorLines = (priorThemeEpisodes || [])
    .map((item) => `E${item.episodeNumberWithinTheme}: ${item.title || 'Untitled'} | ${item.endState || item.ending || 'N/A'}`)
    .join('\n');

  return [
    'You are VicPods continuity editor.',
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
  ].join('\n');
}

function buildToneFixPrompt(input) {
  const { series, theme, episode, effectiveTone, requireTeaser } = input;
  const tone = resolveToneInput(series, effectiveTone);

  return [
    'You are Chef AI Tone Director for VicPods.',
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
    'Preservation rules:',
    '- Keep the same core topic and learning objective.',
    '- Keep continuity with prior end state implied by current ending.',
    '- Improve style fit, clarity, and confidence.',
    requireTeaser === false
      ? '- Ending must remain standalone and not reference a next episode.'
      : '- Ending should preserve teaser momentum for the next episode.',
  ].join('\n');
}

module.exports = {
  buildEpisodeGenerationPrompt,
  buildSpicesPrompt,
  buildContinuityRefreshPrompt,
  buildToneFixPrompt,
};
