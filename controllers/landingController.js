const { renderPage } = require('../utils/render');
const { normalizeNiche } = require('../services/public/publicPodcastIdeaService');
const { getPricingDisplay } = require('../services/billing/pricing');
const {
  getExampleLibraryPageData,
  getFeaturedExamples,
  getLandingProofSnippets,
} = require('../services/marketing/exampleLibraryService');

function normalizeAppUrl() {
  return String(process.env.APP_URL || 'http://localhost:3000')
    .trim()
    .replace(/\/+$/, '');
}

function buildPublicPricingPlans(pricing) {
  return [
    {
      key: 'free',
      eyebrow: 'Start here',
      title: 'Free',
      price: pricing.free,
      summary: 'Prove the workflow before you spend anything.',
      note: 'No card required. Use the public generator first, then move into Studio when you want to keep building.',
      features: [
        'Public idea-to-episode preview with no login',
        'Core Studio + Workspace + Pantry access',
        '5 AI generations each day',
        'Show Notes Pack + TXT episode brief export',
      ],
    },
    {
      key: 'pro',
      eyebrow: 'Best for momentum',
      title: 'Pro',
      price: pricing.pro,
      summary: 'Unlock the full launch workflow for serious weekly publishing.',
      note: `Launch price through ${pricing.foundingDeadlineLabel}. Planned standard price: ${pricing.proStandard}.`,
      features: [
        'Full Launch Pack access after each draft',
        '50 AI generations each day',
        'Continuity refresh + tone consistency scoring',
        'TXT + PDF episode brief exports',
      ],
    },
    {
      key: 'premium',
      eyebrow: 'Maximum control',
      title: 'Premium',
      price: pricing.premium,
      summary: 'Go deeper with unlimited generation and advanced voice control.',
      note: `Launch price through ${pricing.foundingDeadlineLabel}. Planned standard price: ${pricing.premiumStandard}.`,
      features: [
        'Unlimited AI generations',
        'Tone Fix + Voice Persona controls',
        'Highest continuity workflow access',
        'TXT + PDF + DOCX exports',
      ],
    },
  ];
}

function showLanding(req, res) {
  if (req.currentUser?.emailVerified === false) {
    return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
  }

  const pricing = getPricingDisplay();

  return renderPage(res, {
    title: req.t('page.landing.title', 'VicPods - Podcast Planning + Launch Prep'),
    pageTitle: req.t('page.landing.header', 'VicPods'),
    subtitle: req.t('page.landing.subtitle', 'Go from podcast idea to ready-to-record episode.'),
    view: 'landing/index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      featuredExamples: getFeaturedExamples({ limit: 3 }),
      landingProofSnippets: getLandingProofSnippets(),
      pricing,
      publicPricingPlans: buildPublicPricingPlans(pricing),
    },
  });
}

function showPodcastIdeaGenerator(req, res) {
  const normalizedAppUrl = normalizeAppUrl();
  const initialNiche = normalizeNiche(req.query?.niche || '');

  return renderPage(res, {
    title: 'Podcast Idea Generator – Free AI Tool',
    pageTitle: 'Podcast Idea Generator',
    subtitle: 'Generate 10 podcast ideas for free, then turn any one into a structured episode.',
    view: 'tools/podcast-idea-generator',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      metaDescription: 'Generate 10 podcast ideas in seconds with this free AI tool from VicPods. Add a niche or leave it blank, then turn any idea into a real episode preview.',
      canonicalUrl: `${normalizedAppUrl}/podcast-idea-generator`,
      ogTitle: 'Podcast Idea Generator – Free AI Tool',
      ogDescription: 'Generate 10 podcast ideas for free and turn any one into a structured episode preview with VicPods.',
      ogType: 'website',
      ideaGeneratorInitialNiche: initialNiche,
      ideaGeneratorEpisodeBaseUrl: '/',
      featuredExamples: getFeaturedExamples({ limit: 2 }),
    },
  });
}

function showExampleLibrary(req, res) {
  const normalizedAppUrl = normalizeAppUrl();
  const pageData = getExampleLibraryPageData();

  return renderPage(res, {
    title: 'Podcast Episode Examples – VicPods',
    pageTitle: 'Example Library',
    subtitle: 'See how VicPods shapes different podcast styles before you ever create an account.',
    view: 'tools/example-library',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      metaDescription: 'Browse example podcast episodes, launch pack previews, and podcast styles from VicPods. Use any example as a starting point.',
      canonicalUrl: `${normalizedAppUrl}/examples`,
      ogTitle: 'Podcast Episode Examples – VicPods',
      ogDescription: 'Browse episode examples, Launch Pack previews, and podcast styles from VicPods.',
      ogType: 'website',
      ...pageData,
    },
  });
}

module.exports = {
  showLanding,
  showPodcastIdeaGenerator,
  showExampleLibrary,
};
