const TONE_PRESETS = [
  {
    name: 'Educational & Structured',
    description: 'Clear teaching flow with practical steps and definitions.',
    exampleHook: 'Today we break this into a simple 3-step system you can apply immediately.',
    styleRules: [
      'Lead with a clear learning objective.',
      'Use numbered or staged progression.',
      'Define terms quickly before using them.',
      'Avoid fluffy language and vague claims.',
      'Close with one concrete action and expected result.',
    ],
  },
  {
    name: 'Energetic & Motivational',
    description: 'High momentum, action-first, confidence-building language.',
    exampleHook: 'If you are stuck, this episode gets you moving in under 10 minutes.',
    styleRules: [
      'Use energetic verbs and momentum language.',
      'Keep pacing fast with short, punchy lines.',
      'Frame points as immediate wins.',
      'Use controlled enthusiasm without rambling.',
      'End with a bold next action and challenge.',
    ],
  },
  {
    name: 'Analytical & Deep',
    description: 'Evidence-driven, nuanced, and framework-based reasoning.',
    exampleHook: 'The surface advice fails because the underlying model is wrong.',
    styleRules: [
      'Use logic chains, tradeoffs, and causal reasoning.',
      'Reference evidence, metrics, or observable signals.',
      'Keep claims precise and qualified when needed.',
      'Avoid hype language and emotional overreach.',
      'End by naming the next hypothesis to test.',
    ],
  },
  {
    name: 'Storytelling & Emotional',
    description: 'Narrative-first with emotionally resonant listener moments.',
    exampleHook: 'I thought I was ready until one listener comment changed everything.',
    styleRules: [
      'Open with a vivid moment or scene.',
      'Use narrative arc: setup, tension, shift, takeaway.',
      'Use sensory and emotional language sparingly but clearly.',
      'Connect story moments to actionable insight.',
      'End with a reflective takeaway and meaningful teaser.',
    ],
  },
  {
    name: 'Light & Humorous',
    description: 'Friendly, witty, and playful while still structured.',
    exampleHook: 'Let us fix this messy workflow before your coffee gets cold.',
    styleRules: [
      'Use light humor and relatable observations.',
      'Keep jokes short and relevant to the topic.',
      'Do not undercut clarity with excessive banter.',
      'Use playful phrasing while preserving structure.',
      'End with an upbeat action and fun teaser.',
    ],
  },
  {
    name: 'Professional & Corporate',
    description: 'Executive-ready, concise, polished communication style.',
    exampleHook: 'This episode aligns your content plan with measurable business outcomes.',
    styleRules: [
      'Use formal, precise, and concise language.',
      'Tie guidance to strategy, execution, and outcomes.',
      'Prefer low-emotion, high-clarity phrasing.',
      'Avoid slang and overly casual fillers.',
      'End with a clear decision and next milestone.',
    ],
  },
  {
    name: 'Calm & Reflective',
    description: 'Measured pacing, thoughtful framing, and grounded tone.',
    exampleHook: 'Before we optimize anything, let us pause and choose what matters most.',
    styleRules: [
      'Use steady pacing and deliberate transitions.',
      'Favor thoughtful prompts over forceful commands.',
      'Keep language gentle but specific.',
      'Avoid aggressive urgency or dramatic claims.',
      'End with one intentional step and reflective teaser.',
    ],
  },
  {
    name: 'Conversational & Casual',
    description: 'Natural, relatable, and approachable everyday voice.',
    exampleHook: 'Let us talk about the one thing that keeps this from actually working.',
    styleRules: [
      'Use plain language and natural rhythm.',
      'Sound like a trusted host, not a textbook.',
      'Keep examples practical and relatable.',
      'Avoid over-formality and heavy jargon.',
      'End with a simple action and easy next hook.',
    ],
  },
  {
    name: 'Bold & Controversial',
    description: 'Sharp point of view, respectful challenge, high conviction.',
    exampleHook: 'Hot take: most podcast planning advice quietly kills your growth.',
    styleRules: [
      'Lead with a strong claim grounded in reasoning.',
      'Challenge common assumptions respectfully.',
      'Keep arguments sharp, specific, and defensible.',
      'Avoid clickbait phrasing without substance.',
      'End with a high-stakes teaser and decisive action.',
    ],
  },
];

const TONE_PRESET_NAMES = TONE_PRESETS.map((preset) => preset.name);

const TONE_PRESET_MAP = new Map(TONE_PRESETS.map((preset) => [preset.name, preset]));

module.exports = {
  TONE_PRESETS,
  TONE_PRESET_NAMES,
  TONE_PRESET_MAP,
};
