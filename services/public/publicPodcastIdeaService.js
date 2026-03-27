const aiService = require('../ai/aiService');
const { normalizeLanguage } = require('../i18n/languageService');
const { AppError } = require('../../utils/errors');

const PODCAST_IDEA_COUNT = 10;
const NICHE_MAX_LENGTH = 120;

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function clampText(value, maxLength) {
  return cleanText(value).slice(0, maxLength);
}

function toTitleCase(value) {
  return cleanText(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizeNiche(value) {
  return clampText(value, NICHE_MAX_LENGTH);
}

function fallbackTopic(niche) {
  const normalizedNiche = normalizeNiche(niche);
  return normalizedNiche || 'podcast growth';
}

function buildFallbackIdeas(niche) {
  const topic = fallbackTopic(niche);
  const titleTopic = toTitleCase(topic) || 'Podcast Growth';

  return [
    {
      title: `How To Build A Sharper ${titleTopic} Episode`,
      hookAngle: `Turn one broad ${topic.toLowerCase()} topic into a tight episode listeners can act on today.`,
    },
    {
      title: `The ${titleTopic} Mistake That Weakens Good Podcast Ideas`,
      hookAngle: `Use a myth-busting angle to show why strong topics still fail when the host stays too generic.`,
    },
    {
      title: `What Your Audience Actually Wants From ${titleTopic}`,
      hookAngle: `Frame the episode around the questions listeners quietly have before they ever click play.`,
    },
    {
      title: `A Better Framework For Talking About ${titleTopic}`,
      hookAngle: `Replace scattered advice with a simple structure that gives the audience a clearer next step.`,
    },
    {
      title: `Why ${titleTopic} Needs A Stronger Opening Angle`,
      hookAngle: `Start with the friction point first, then show how the rest of the episode earns attention.`,
    },
    {
      title: `The Story Angle That Makes ${titleTopic} More Memorable`,
      hookAngle: `Use a scene or relatable moment to make the lesson land before moving into strategy.`,
    },
    {
      title: `How Great Hosts Make ${titleTopic} Sound More Specific`,
      hookAngle: `Break down the shift from vague talking points to concrete, useful, publish-ready structure.`,
    },
    {
      title: `The ${titleTopic} Questions Worth Answering On Mic`,
      hookAngle: `Build the episode around high-signal listener questions instead of starting with a generic overview.`,
    },
    {
      title: `When ${titleTopic} Is Worth Recording And When It Is Not`,
      hookAngle: `Use a decision-led angle that helps creators spot the difference between a topic and a real episode idea.`,
    },
    {
      title: `Turn ${titleTopic} Into A Clear Listener Transformation`,
      hookAngle: `Show how to move from topic selection to a stronger promise, cleaner structure, and better close.`,
    },
  ];
}

function dedupeIdeas(ideas) {
  const seen = new Set();

  return (ideas || []).filter((idea) => {
    const key = cleanText(idea?.title).toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function normalizeIdeas(items) {
  return (items || [])
    .map((item) => ({
      title: clampText(item?.title, 140),
      hookAngle: clampText(item?.hookAngle, 280),
    }))
    .filter((item) => item.title && item.hookAngle);
}

async function generatePublicPodcastIdeas({ niche, language }) {
  const normalizedNiche = normalizeNiche(niche);

  if (normalizedNiche.length > NICHE_MAX_LENGTH) {
    throw new AppError(`Keep the niche under ${NICHE_MAX_LENGTH} characters.`, 400);
  }

  const generated = await aiService.generatePodcastIdeas({
    niche: normalizedNiche,
    language: normalizeLanguage(language),
  });

  const ideas = dedupeIdeas([
    ...normalizeIdeas(generated?.ideas),
    ...buildFallbackIdeas(normalizedNiche),
  ]).slice(0, PODCAST_IDEA_COUNT);

  return {
    niche: normalizedNiche,
    ideas,
  };
}

module.exports = {
  NICHE_MAX_LENGTH,
  PODCAST_IDEA_COUNT,
  generatePublicPodcastIdeas,
  normalizeNiche,
};
