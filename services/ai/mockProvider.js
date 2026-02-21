const { refreshContinuityFromEpisodes } = require('../continuityService');

function hashSeed(text) {
  return [...String(text || '')].reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function pickRotating(list, seed, count) {
  const output = [];
  for (let i = 0; i < count; i += 1) {
    output.push(list[(seed + i) % list.length]);
  }
  return output;
}

class MockProvider {
  constructor() {
    this.name = 'mock';
  }

  async generateEpisodeDraft(input) {
    const {
      series,
      theme,
      episodeNumberWithinTheme,
      previousEpisodeEndState,
      ingredientHooks,
    } = input;

    const seed = hashSeed(`${series.name}-${theme.name}-${episodeNumberWithinTheme}`);

    const outlinePool = [
      'Cold open story that reframes the theme problem',
      'Theme-specific challenge breakdown',
      'Real creator example with one tactical lesson',
      'Quick myth-busting segment with nuance',
      'Action checklist listeners can apply today',
      'Mini listener scenario and reaction',
      'Transition to the next theme episode',
    ];

    const talkingPool = [
      'Clarify the one promise this episode delivers',
      'Contrast beginner and advanced execution paths',
      'Call out a common overthinking trap',
      'Share a lightweight framework for consistency',
      'Point to one measurable signal of progress',
      'Translate abstract advice into repeatable steps',
      'Link this episode to the theme arc',
    ];

    const questionPool = [
      'What part of this theme feels heavier than it should?',
      'If you had one hour this week, where would you focus?',
      'What evidence shows this theme is resonating?',
      'Where are you choosing comfort over momentum?',
      'What experiment can you run before the next episode?',
      'Which story would make this insight stick?',
      'What teaser line earns the next listen?',
      'What can be simplified without losing depth?',
    ];

    const forwardLine = previousEpisodeEndState
      ? `We continue this theme from the last end state: ${previousEpisodeEndState}`
      : `This is the opening chapter for the ${theme.name} theme. ${theme.themeSummary || 'Set a clear thesis and momentum.'}`;

    const ingredientText = ingredientHooks && ingredientHooks.length
      ? `Ingredient boost: ${ingredientHooks[0]}.`
      : 'Ingredient boost: a relatable creator scenario.';

    return {
      title: `${theme.name}: Episode ${episodeNumberWithinTheme} - Momentum Menu`,
      hook: `${forwardLine} ${ingredientText}`,
      outline: pickRotating(outlinePool, seed, 7),
      talkingPoints: pickRotating(talkingPool, seed + 2, 7),
      hostQuestions: pickRotating(questionPool, seed + 4, 8),
      funSegment: 'Dilemma: Would you rather ship quickly or polish deeply for this theme?',
      ending: 'Takeaway: keep the arc focused and practical. Teaser: next episode raises the stakes with a tougher scenario.',
      endState: `The host advanced the ${theme.name} arc with one practical system and set up a stronger follow-up test.`,
      seriesSummary: `${series.name} follows creators building repeatable systems with continuity across themed episode arcs.`,
      themeSummary: `${theme.name} is an active arc focused on tactical steps, clear experiments, and compounding listener value.`,
    };
  }

  async generateSpices(input) {
    const { series, theme, episodeNumberWithinTheme } = input;
    const seed = hashSeed(`${series.name}-${theme.name}-spice-${episodeNumberWithinTheme}`);

    const hooks = [
      `What if ${theme.name} could click in one recording session?`,
      `Today we make ${theme.name} practical, fast, and repeatable.`,
      `If ${theme.name} feels messy, this one shift will reset your flow.`,
    ];

    const questions = [
      'Which point deserves a stronger personal story?',
      'What would make this episode instantly shareable?',
      'Where can you surprise your audience without losing clarity?',
      'What teaser line earns the next listen?',
      'Which part sounds generic and needs your voice?',
      'What can you cut to make the core insight land harder?',
      'What challenge should carry into the next theme episode?',
      'What would your future self wish you recorded today?',
    ];

    return {
      hook: hooks[seed % hooks.length],
      hostQuestions: pickRotating(questions, seed, 8),
      funSegment: `Game: 60-second hook battle centered on ${theme.name}.`,
    };
  }

  async refreshContinuity(input) {
    return refreshContinuityFromEpisodes({
      series: input.series,
      theme: input.theme,
      priorThemeEpisodes: input.priorThemeEpisodes,
      recentSeriesEpisodes: input.recentSeriesEpisodes,
      currentEpisode: input.episode,
    });
  }
}

module.exports = {
  MockProvider,
};
