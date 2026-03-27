const { renderPage } = require('../utils/render');
const { normalizeNiche } = require('../services/public/publicPodcastIdeaService');
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

function showLanding(req, res) {
  if (req.currentUser?.emailVerified === false) {
    return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
  }

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
