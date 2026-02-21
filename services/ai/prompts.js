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
  } = input;

  return [
    'You are Chef AI for VicPods, writing compact podcast episode drafts.',
    'Rules:',
    '- Keep output concise and structured.',
    '- Primary continuity is within the SAME theme only.',
    '- If this is the first episode in the theme, rely on seriesSummary + themeSummary.',
    '- Avoid repeating old episode content in this theme.',
    '- Move continuity forward and end with wrap + teaser.',
    '- Stay in the selected tone.',
    '',
    `Series Name: ${series.name}`,
    `Series Description: ${series.description || 'N/A'}`,
    `Tone: ${series.tone}`,
    `Audience: ${series.audience || 'General'}`,
    `Series Summary: ${series.seriesSummary || 'No summary yet.'}`,
    `Theme Name: ${theme.name}`,
    `Theme Description: ${theme.description || 'N/A'}`,
    `Theme Summary: ${theme.themeSummary || 'No theme summary yet.'}`,
    `Episode Number Within Theme: ${episodeNumberWithinTheme}`,
    `Global Episode Number (series-wide): ${globalEpisodeNumber || 'N/A'}`,
    `Existing Title (optional): ${existingTitle || 'N/A'}`,
    `Previous Theme Episode End State: ${previousEpisodeEndState || 'No previous episode in this theme.'}`,
    `Already Covered Theme Episode Titles: ${(existingEpisodeTitles || []).join(', ') || 'None yet.'}`,
    `Pantry Ingredient Hooks: ${(ingredientHooks || []).join(' | ') || 'None selected.'}`,
    '',
    'Return valid JSON only with keys:',
    'title, hook, outline, talkingPoints, hostQuestions, funSegment, ending, endState, seriesSummary, themeSummary',
    'Constraints:',
    '- hook: 1-2 lines',
    '- outline: max 7 bullets',
    '- talkingPoints: max 7 bullets',
    '- hostQuestions: max 8 bullets',
    '- funSegment: one short game/dilemma',
    '- ending: 1-2 lines (takeaway + teaser)',
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
  } = input;

  return [
    'You are Chef AI for VicPods. Regenerate ONLY spices for this episode.',
    'Return valid JSON with keys: hook, hostQuestions, funSegment.',
    'Keep concise. Keep continuity inside this theme and avoid repetition.',
    `Series Name: ${series.name}`,
    `Theme Name: ${theme.name}`,
    `Theme Summary: ${theme.themeSummary || 'N/A'}`,
    `Tone: ${series.tone}`,
    `Audience: ${series.audience || 'General'}`,
    `Episode Number Within Theme: ${episodeNumberWithinTheme}`,
    `Current Hook: ${currentHook || 'N/A'}`,
    `Existing Talking Points: ${(existingTalkingPoints || []).join(' | ') || 'N/A'}`,
    `Previous Theme Episode End State: ${previousEpisodeEndState || 'No previous episode in theme.'}`,
    'Constraints: hook 1-2 lines; hostQuestions max 8 bullets; funSegment one short game/dilemma.',
  ].join('\n');
}

function buildContinuityRefreshPrompt(input) {
  const { series, theme, episode, priorThemeEpisodes } = input;

  const priorLines = (priorThemeEpisodes || [])
    .map((item) => `E${item.episodeNumberWithinTheme}: ${item.title || 'Untitled'} | ${item.endState || item.ending || 'N/A'}`)
    .join('\n');

  return [
    'You are VicPods continuity editor.',
    'Return valid JSON only with keys: seriesSummary, themeSummary, endState.',
    'seriesSummary max 120 words. themeSummary max 120 words. endState max 80 words.',
    `Series: ${series.name}`,
    `Series Description: ${series.description || 'N/A'}`,
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
  ].join('\n');
}

module.exports = {
  buildEpisodeGenerationPrompt,
  buildSpicesPrompt,
  buildContinuityRefreshPrompt,
};
