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
      summary: 'See whether the workflow fits before you spend anything.',
      note: 'No card required. Generate the preview first, then create an account only when you want to keep building.',
      features: [
        'Public idea-to-episode preview with no login',
        'Core Studio + Workspace + Pantry access',
        '5 AI generations each day',
        'TXT episode brief + starter launch workflow',
      ],
    },
    {
      key: 'pro',
      eyebrow: 'Best for momentum',
      title: 'Pro',
      price: pricing.pro,
      summary: 'Unlock the full draft and launch workflow for serious weekly publishing.',
      note: `Launch price through ${pricing.foundingDeadlineLabel}. Planned standard price: ${pricing.proStandard}.`,
      features: [
        'Full Launch Pack after each draft',
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
      summary: 'Go deeper with unlimited generation, stronger control, and richer exports.',
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

function buildLandingMomentumCards() {
  return [
    {
      eyebrow: 'See value first',
      title: 'Generate before you sign up',
      body: 'Paste the idea you were planning to record next. VicPods shows the structure before asking for commitment.',
    },
    {
      eyebrow: 'Built for real formats',
      title: 'Made for the shows creators actually publish',
      body: 'Solo educators, interview shows, business podcasts, coaches, and personal-brand creators all start from a clearer episode shape.',
    },
    {
      eyebrow: 'Upgrade when it clicks',
      title: 'Unlock the full draft and launch pack only when it saves you time',
      body: 'Free proves the workflow. Pro and Premium turn the preview into publish-ready drafting, launch assets, and higher-volume output.',
    },
  ];
}

function showLanding(req, res) {
  if (req.currentUser?.emailVerified === false) {
    return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
  }

  const pricing = getPricingDisplay();
  const normalizedAppUrl = normalizeAppUrl();
  const isPerformanceLanding = req.path === '/generate-episode';

  return renderPage(res, {
    title: isPerformanceLanding
      ? 'Generate a Podcast Episode Preview - VicPods'
      : req.t('page.landing.title', 'VicPods - Turn podcast ideas into ready-to-record episodes'),
    pageTitle: req.t('page.landing.header', 'VicPods'),
    subtitle: req.t('page.landing.subtitle', 'Turn one podcast idea into a ready-to-record episode.'),
    view: 'landing/index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      metaDescription: 'Turn a rough podcast idea into a stronger title, sharper hook, structured outline, and launch-ready direction with VicPods. Generate the preview before you sign up.',
      canonicalUrl: `${normalizedAppUrl}/`,
      metaRobots: isPerformanceLanding ? 'noindex,follow' : undefined,
      ogTitle: 'VicPods - Turn podcast ideas into ready-to-record episodes',
      ogDescription: 'Generate a podcast episode preview with a stronger title, hook, outline, and launch-ready direction before you create an account.',
      ogType: 'website',
      featuredExamples: getFeaturedExamples({ limit: 3 }),
      landingProofSnippets: getLandingProofSnippets(),
      landingMomentumCards: buildLandingMomentumCards(),
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
