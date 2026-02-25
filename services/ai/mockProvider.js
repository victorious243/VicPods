const { refreshContinuityFromEpisodes } = require('../continuityService');
const { getTonePresetOrDefault } = require('../tone/applyTone');

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

function buildToneAccent(tonePreset, intensity) {
  const preset = getTonePresetOrDefault(tonePreset);
  const power = Number.isInteger(intensity) ? intensity : 3;

  const accentByPreset = {
    'Educational & Structured': 'Break it into explicit steps and definitions.',
    'Energetic & Motivational': 'Use urgency and momentum language with short lines.',
    'Analytical & Deep': 'Use frameworks, evidence, and tradeoff language.',
    'Storytelling & Emotional': 'Frame points through scenes, tension, and emotional clarity.',
    'Light & Humorous': 'Use light wit and playful turns while staying clear.',
    'Professional & Corporate': 'Use executive-level precision and outcome language.',
    'Calm & Reflective': 'Use steady pacing and intentional reflective framing.',
    'Conversational & Casual': 'Use natural host voice and plain language.',
    'Bold & Controversial': 'Lead with a respectful high-conviction claim.',
  };

  return `${preset.name} (${power}/5): ${accentByPreset[preset.name] || accentByPreset['Conversational & Casual']}`;
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
      effectiveTone,
      includeFunSegment,
      isStandalone,
      requireTeaser,
      episodeType,
      targetLength,
    } = input;

    const seed = hashSeed(`${series.name}-${theme.name}-${episodeNumberWithinTheme}`);
    const goal = series.goal || 'Build a successful podcast plan with clear structure and measurable progress.';
    const tonePreset = effectiveTone?.tonePreset || series.tonePreset;
    const toneIntensity = effectiveTone?.toneIntensity || series.toneIntensity || 3;
    const toneAccent = buildToneAccent(tonePreset, toneIntensity);

    const outlinePool = [
      'Hook the listener problem and state this episode milestone',
      'Explain the practical model behind today\'s decision',
      'Use one creator example to prove execution detail',
      'Translate model into a short weekly action checklist',
      'Define one measurable checkpoint for progress',
      'Handle one likely listener objection quickly',
      'Bridge forward to the next episode challenge',
    ];

    const talkingPool = [
      'Name the promise and who benefits first',
      'Tie this promise directly to the series goal',
      'Clarify where people overcomplicate this step',
      'Give one framework that can be reused each week',
      'Set one metric listeners can track immediately',
      'Convert insight into a concrete execution sequence',
      'Preview how this creates momentum for the next episode',
    ];

    const questionPool = [
      'What proof will show this move is actually working?',
      'What can you ship this week instead of over-planning?',
      'Which point needs a stronger host story?',
      'What tradeoff are you avoiding right now?',
      'What listener objection should you address directly?',
      'What one metric should improve before next episode?',
      'What teaser line best earns the next listen?',
      'What can you simplify without losing depth?',
    ];

    const forwardLine = previousEpisodeEndState
      ? `Carry forward from prior episode: ${previousEpisodeEndState}`
      : `This opens the ${theme.name} arc with a clear first milestone.`;

    const ingredientText = ingredientHooks && ingredientHooks.length
      ? `Ingredient: ${ingredientHooks[0]}.`
      : 'Ingredient: a relatable creator field example.';

    return {
      title: `${theme.name}: Episode ${episodeNumberWithinTheme} - Structured Momentum${episodeType === 'interview' ? ' (Interview)' : ''}${targetLength ? ` [${targetLength}]` : ''}`,
      hook: `${forwardLine} ${toneAccent} ${ingredientText}`,
      outline: pickRotating(outlinePool, seed, 7),
      talkingPoints: pickRotating(talkingPool, seed + 2, 7),
      hostQuestions: pickRotating(questionPool, seed + 4, 8),
      funSegment: includeFunSegment === false
        ? ''
        : 'Dilemma: choose one bold experiment vs one reliable system for next week.',
      ending: requireTeaser === false
        ? 'Takeaway: execute one specific action before your next recording and close with confidence.'
        : 'Takeaway: execute one specific action before your next recording. Teaser: next episode pressure-tests this with a tougher scenario.',
      endState: isStandalone
        ? 'Episode closed with a complete standalone outcome and one clear next action for listeners.'
        : `The host advanced ${theme.name} toward goal: ${goal}, with one action completed and one measurable next checkpoint set.`,
      seriesSummary: `${series.name} tracks creators executing a consistent podcast growth plan toward: ${goal}`,
      themeSummary: `${theme.name} now emphasizes practical execution, measurable checkpoints, and tight continuity in ${tonePreset} style.`,
    };
  }

  async generateSpices(input) {
    const {
      series,
      theme,
      episodeNumberWithinTheme,
      effectiveTone,
      includeFunSegment,
    } = input;

    const seed = hashSeed(`${series.name}-${theme.name}-spice-${episodeNumberWithinTheme}`);
    const tonePreset = effectiveTone?.tonePreset || series.tonePreset;
    const toneIntensity = effectiveTone?.toneIntensity || series.toneIntensity || 3;

    const hooks = [
      `This episode pushes ${theme.name} forward with ${tonePreset.toLowerCase()} clarity (${toneIntensity}/5).`,
      `If ${theme.name} is stuck, this is the fastest path to forward momentum this week.`,
      `Let us tighten ${theme.name} into actions you can record and ship today.`,
    ];

    const questions = [
      'What is the one decision this episode must force?',
      'What would make this segment clearer in your own voice?',
      'Where can you be more specific without being longer?',
      'What point should challenge the listener\'s default assumption?',
      'What practical action should listeners take in 24 hours?',
      'What evidence would strengthen this claim?',
      'What teaser line creates urgency for the next episode?',
      'What should be removed to keep this concise?',
    ];

    return {
      hook: hooks[seed % hooks.length],
      hostQuestions: pickRotating(questions, seed, 8),
      funSegment: includeFunSegment === false
        ? ''
        : `Rapid-fire: in 60 seconds, defend the strongest ${tonePreset} angle for this theme.`,
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

  async fixTone(input) {
    const tonePreset = input.effectiveTone?.tonePreset || input.series.tonePreset || 'Conversational & Casual';
    const toneIntensity = input.effectiveTone?.toneIntensity || input.series.toneIntensity || 3;

    return {
      hook: `${input.episode.hook || 'This episode gets straight to the point.'} Tone alignment: ${tonePreset} (${toneIntensity}/5).`,
      hostQuestions: (input.episode.hostQuestions || []).slice(0, 8).map((question) => `${question}`),
      ending: input.requireTeaser === false
        ? (input.episode.ending || 'Takeaway: execute one action and close the episode with clarity.')
        : `${input.episode.ending || 'Takeaway: execute one action.'} Teaser: next episode deepens this with a sharper constraint.`,
    };
  }
}

module.exports = {
  MockProvider,
};
