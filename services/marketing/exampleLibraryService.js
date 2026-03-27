const { getPodcastTemplates } = require('../templates/podcastTemplateService');

const EXAMPLE_EPISODES = [
  {
    slug: 'solo-educator-audience-trust',
    styleLabel: 'Solo Educator',
    templateKey: 'solo_educator',
    title: 'How To Build Audience Trust Before You Sell Anything',
    hook: 'This episode shows how creators can earn buying intent by sequencing trust-building moments before a single pitch ever lands.',
    outline: [
      'Open with the mistake creators make when they rush the ask.',
      'Break trust-building into three moments listeners need before buying.',
      'Show one example of trust signals inside a real episode.',
      'Close with the CTA that fits once trust is already in place.',
    ],
    launchPack: {
      titles: [
        'How To Build Audience Trust Before You Sell',
        'The Trust Sequence Every Creator Should Use Before Pitching',
        'Why Listeners Buy After Trust, Not Pressure',
      ],
      description: 'A clean weekly episode for educators and coaches who want stronger conversion without forcing the pitch too early.',
    },
    ideaSeed: 'How creators can build audience trust before selling anything on their podcast.',
    takeaway: 'Useful for expert-led weekly shows that need a sharper educational arc.',
  },
  {
    slug: 'interview-show-better-guest-conversations',
    styleLabel: 'Interview Show',
    templateKey: 'interview_show',
    title: 'The Interview Questions That Pull Out Better Stories',
    hook: 'Instead of generic guest prompts, this angle focuses on the specific question sequence that gets the guest into real, memorable detail.',
    outline: [
      'Explain why surface-level questions flatten good guests.',
      'Walk through the opener, pivot, and depth question sequence.',
      'Show how to follow a guest answer without derailing the episode.',
      'End with a guest-prep checklist hosts can use before recording.',
    ],
    launchPack: {
      titles: [
        'The Interview Questions That Pull Out Better Stories',
        'A Better Question Flow For Guest Episodes',
        'How Great Hosts Get Guests To Say Something Real',
      ],
      description: 'An interview-show example for hosts who want guests to sound sharper, more specific, and more memorable on mic.',
    },
    ideaSeed: 'A better question sequence for podcast hosts who want guests to share stronger stories.',
    takeaway: 'Useful for guest-led shows that need better conversational structure.',
  },
  {
    slug: 'business-podcast-launch-cadence',
    styleLabel: 'Business Podcast',
    templateKey: 'business_podcast',
    title: 'Why Most Podcast Launch Calendars Collapse By Week Three',
    hook: 'This business-focused episode reframes consistency as an operating system problem, not a motivation problem.',
    outline: [
      'Open with the hidden reason launch calendars fall apart after the early burst.',
      'Show the operational gaps behind missed releases.',
      'Introduce the cadence system that makes weekly publishing repeatable.',
      'Give the listener a simple reset plan for the next 30 days.',
    ],
    launchPack: {
      titles: [
        'Why Most Podcast Launch Calendars Collapse By Week Three',
        'The Publishing System Stronger Business Podcasts Use',
        'How To Keep Your Podcast Launch Consistent After Week One',
      ],
      description: 'A launch-prep example for business creators who want a repeatable release system instead of last-minute scramble.',
    },
    ideaSeed: 'Why podcast launch calendars break down and how creators can build a repeatable publishing system.',
    takeaway: 'Useful for business shows that need operational clarity, not more vague motivation.',
  },
];

const LANDING_PROOF_SNIPPETS = [
  {
    eyebrow: 'Example workflow',
    title: 'Go from raw topic to structured episode fast',
    body: 'Use the public generator to see the hook, outline, CTA, and launch preview before you even sign up.',
    ctaLabel: 'See examples',
    ctaHref: '/examples',
  },
  {
    eyebrow: 'Creator fit',
    title: 'Built for solo, interview, and business formats',
    body: 'VicPods already models podcast styles that creators actually publish, so you start from a shape instead of a blank page.',
    ctaLabel: 'Explore templates',
    ctaHref: '/create/single',
  },
  {
    eyebrow: 'Launch prep',
    title: 'Episodes leave with publish-ready assets',
    body: 'Launch Packs turn a generated episode into title options, a description, and lightweight launch copy you can use today.',
    ctaLabel: 'Try the generator',
    ctaHref: '/#idea-to-episode-generator',
  },
];

const BILLING_PROOF_SNIPPETS = [
  {
    eyebrow: 'Pro workflow',
    title: 'Keep a weekly show moving without rebuilding every episode',
    body: 'Pro unlocks higher daily generation limits, continuity refresh, PDF briefs, and full Launch Pack access for faster weekly publishing.',
    ctaLabel: 'Review plans',
    ctaHref: '/settings?section=billing',
  },
  {
    eyebrow: 'Premium control',
    title: 'Use VicPods like a full launch-prep system',
    body: 'Premium adds unlimited AI generations, tone controls, deeper exports, and the strongest drafting workflow for high-output creators.',
    ctaLabel: 'See premium',
    ctaHref: '/settings?section=billing',
  },
  {
    eyebrow: 'Product proof',
    title: 'The value is visible before the upgrade',
    body: 'Public episode previews, example library entries, and free watermarked exports show exactly what the workflow can produce.',
    ctaLabel: 'Open examples',
    ctaHref: '/examples',
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getFeaturedExamples({ limit } = {}) {
  const items = clone(EXAMPLE_EPISODES);
  if (Number.isInteger(limit) && limit > 0) {
    return items.slice(0, limit);
  }
  return items;
}

function getLandingProofSnippets() {
  return clone(LANDING_PROOF_SNIPPETS);
}

function getBillingProofSnippets() {
  return clone(BILLING_PROOF_SNIPPETS);
}

function getExampleLibraryPageData() {
  return {
    examples: getFeaturedExamples(),
    proofSnippets: getLandingProofSnippets(),
    podcastStyles: getPodcastTemplates(),
  };
}

module.exports = {
  getBillingProofSnippets,
  getExampleLibraryPageData,
  getFeaturedExamples,
  getLandingProofSnippets,
};
