const { renderPage } = require('../utils/render');
const { normalizeNiche } = require('../services/public/publicPodcastIdeaService');
const { getPricingDisplay } = require('../services/billing/pricing');
const {
  getIncludedHostingPlan,
} = require('../services/billing/planCatalog');
const {
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildOrganizationSchema,
  buildPublicPageSeo,
  buildSoftwareApplicationSchema,
  buildWebsiteSchema,
} = require('../services/seo/siteSeoService');
const {
  getExampleLibraryPageData,
  getFeaturedExamples,
  getLandingProofSnippets,
} = require('../services/marketing/exampleLibraryService');

function buildPublicPricingPlans(pricing) {
  const workspacePlansByKey = new Map((pricing.workspacePlans || []).map((plan) => [plan.key, plan]));
  const getPlanPrice = (key, fallback) => workspacePlansByKey.get(key)?.price || fallback;

  return [
    {
      key: 'free',
      eyebrow: 'Start here',
      title: 'Free',
      price: getPlanPrice('free', pricing.free),
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
      key: 'creator',
      eyebrow: 'Best for momentum',
      title: 'Creator',
      price: getPlanPrice('creator', pricing.pro),
      summary: 'Plan, draft, and publish one serious weekly show.',
      note: 'Includes Starter Hosting capacity for one hosted show.',
      features: [
        'Full Launch Pack after each draft',
        '50 AI generations each day',
        'Continuity refresh + tone consistency scoring',
        'One hosted show with RSS and public page',
      ],
    },
    {
      key: 'growth',
      eyebrow: 'Maximum control',
      title: 'Growth',
      price: getPlanPrice('growth', pricing.premium),
      summary: 'Run multiple shows with stronger analytics, promotion, and publishing control.',
      note: 'Includes Growth Hosting capacity for up to three hosted shows.',
      features: [
        '150 AI generations each day',
        'Tone Fix + Voice Persona controls',
        'Advanced analytics recommendations',
        'Sponsor kit, private-feed setup, and promotion assets',
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
      body: 'Free proves the workflow. Creator and Growth turn the preview into publish-ready drafting, launch assets, hosting, and higher-volume output.',
    },
  ];
}

function formatLimit(value, suffix = '') {
  if (value === Infinity) {
    return 'Unlimited';
  }

  return `${value}${suffix}`;
}

function buildPricingPageData(pricing) {
  const workspacePlans = (pricing.workspacePlans || []).map((plan) => {
    const includedHostingKey = getIncludedHostingPlan(plan.key);
    const includedHosting = (pricing.hostingPlans || []).find((hostingPlan) => hostingPlan.key === includedHostingKey);

    return {
      ...plan,
      includedHostingKey,
      includedHostingTitle: includedHosting?.title || 'No Hosting',
      fit: {
        free: 'Idea testing and light planning',
        creator: 'One weekly podcast with hosting included',
        growth: 'Multiple shows, promotion, analytics, and collaborators',
        studio: 'Teams, agencies, and podcast networks',
      }[plan.key] || 'Podcast production',
      limitsText: [
        formatLimit(plan.limits.aiActionsPerDay, ' AI actions/day'),
        formatLimit(plan.limits.savedEpisodes, ' saved episodes'),
        formatLimit(plan.limits.hostedShows, ' hosted shows'),
        formatLimit(plan.limits.collaborators, ' seats'),
      ],
    };
  });
  const hostingAddOns = (pricing.hostingPlans || [])
    .filter((plan) => plan.key !== 'none')
    .map((plan) => ({
      ...plan,
      includedByWorkspace: workspacePlans
        .filter((workspacePlan) => workspacePlan.includedHostingKey === plan.key)
        .map((workspacePlan) => workspacePlan.title)
        .join(', '),
      limitsText: [
        `${plan.limits.hostedShows} hosted shows`,
        `${plan.limits.storageGb} GB storage`,
        `${plan.limits.uploadHoursPerMonth} upload hr/mo`,
        `${plan.limits.monthlyDownloads.toLocaleString()} downloads/mo`,
      ],
    }));

  return {
    workspacePlans,
    hostingAddOns,
    billingNotes: [
      {
        label: 'Workspace',
        title: 'Pay for the production room',
        body: 'Workspace plans unlock planning, drafting, launch packs, analytics, teams, and the included hosting tier listed on the plan.',
      },
      {
        label: 'Included hosting',
        title: 'Most creators do not need a separate hosting bill',
        body: 'Creator includes Starter Hosting. Growth includes Growth Hosting. Studio includes Studio Hosting.',
      },
      {
        label: 'Hosting add-ons',
        title: 'Only buy more when you outgrow included capacity',
        body: 'Add-on hosting is only for capacity above what your workspace already includes.',
      },
    ],
  };
}

function showLanding(req, res) {
  if (req.currentUser?.emailVerified === false) {
    return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
  }

  const pricing = getPricingDisplay();
  const isPerformanceLanding = req.path === '/generate-episode';
  const isLabAlias = req.path === '/lab';
  const title = isPerformanceLanding
    ? 'Generate a Podcast Episode Preview - Free AI Tool - VicPods'
    : 'VicPods - AI Podcast Planning and Launch Prep Workspace';
  const description = isPerformanceLanding
    ? 'Generate a free podcast episode preview with VicPods. Turn a rough idea into a stronger title, hook, outline, CTA, and launch direction before you sign up.'
    : 'VicPods is an AI-powered podcast planning and launch-prep workspace that helps creators turn rough ideas into structured episodes, show notes, launch assets, and exportable episode briefs.';
  const seo = buildPublicPageSeo({
    path: isPerformanceLanding ? '/generate-episode' : '/',
    title,
    description,
    robots: isLabAlias ? 'noindex,nofollow' : undefined,
    structuredData: [
      buildOrganizationSchema(),
      buildWebsiteSchema(),
      buildSoftwareApplicationSchema(),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: req.t('page.landing.header', 'VicPods'),
    subtitle: req.t('page.landing.subtitle', 'Turn one podcast idea into a ready-to-record episode.'),
    view: 'landing/index',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
      featuredExamples: getFeaturedExamples({ limit: 3 }),
      landingProofSnippets: getLandingProofSnippets(),
      landingMomentumCards: buildLandingMomentumCards(),
      pricing,
      publicPricingPlans: buildPublicPricingPlans(pricing),
    },
  });
}

function showPricing(req, res) {
  const pricing = getPricingDisplay();
  const title = 'Pricing - VicPods';
  const description = 'See VicPods pricing clearly. Compare Free, Creator, Growth, and Studio workspace plans, included podcast hosting capacity, and when hosting add-ons are needed.';
  const faq = [
    {
      question: 'Do Workspace plans include podcast hosting?',
      answer: 'Yes. Creator includes Starter Hosting, Growth includes Growth Hosting, and Studio includes Studio Hosting. Hosting add-ons are only for capacity above the included tier.',
    },
    {
      question: 'Can I start free?',
      answer: 'Yes. The Free plan lets you try the public generator and core planning workflow before upgrading.',
    },
    {
      question: 'Are paid private feeds live?',
      answer: 'Paid private feeds remain in setup mode until Stripe Connect payouts are enabled.',
    },
  ];
  const seo = buildPublicPageSeo({
    path: '/pricing',
    title,
    description,
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Pricing', path: '/pricing' },
      ]),
      buildSoftwareApplicationSchema(),
      buildFaqSchema(faq),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: 'Pricing',
    subtitle: 'Understand what you pay for and what you can use.',
    view: 'tools/pricing',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
      pricing,
      pricingPage: buildPricingPageData(pricing),
      faq,
    },
  });
}

function showPodcastIdeaGenerator(req, res) {
  const initialNiche = normalizeNiche(req.query?.niche || '');
  const title = 'Podcast Idea Generator – Free AI Tool';
  const description = 'Generate 10 podcast ideas in seconds with this free AI tool from VicPods. Add a niche or leave it blank, then turn any idea into a real episode preview.';
  const faq = [
    {
      question: 'Is the podcast idea generator free?',
      answer: 'Yes. You can generate podcast ideas without logging in, then turn a promising idea into a structured episode preview.',
    },
    {
      question: 'What should I enter as a niche?',
      answer: 'Use a short audience, industry, or topic area such as business podcast, real estate, coaching, ministry, or personal branding.',
    },
  ];
  const seo = buildPublicPageSeo({
    path: '/podcast-idea-generator',
    title,
    description,
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Podcast Idea Generator', path: '/podcast-idea-generator' },
      ]),
      buildSoftwareApplicationSchema(),
      buildFaqSchema(faq),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: 'Podcast Idea Generator',
    subtitle: 'Generate 10 podcast ideas for free, then turn any one into a structured episode.',
    view: 'tools/podcast-idea-generator',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
      ideaGeneratorInitialNiche: initialNiche,
      ideaGeneratorEpisodeBaseUrl: '/',
      featuredExamples: getFeaturedExamples({ limit: 2 }),
      faq,
    },
  });
}

function showExampleLibrary(req, res) {
  const pageData = getExampleLibraryPageData();
  const title = 'Podcast Episode Examples – VicPods';
  const description = 'Browse example podcast episodes, launch pack previews, and podcast styles from VicPods. Use any example as a starting point.';
  const seo = buildPublicPageSeo({
    path: '/examples',
    title,
    description,
    structuredData: [
      buildBreadcrumbSchema([
        { name: 'VicPods', path: '/' },
        { name: 'Examples', path: '/examples' },
      ]),
    ],
  });

  return renderPage(res, {
    title,
    pageTitle: 'Example Library',
    subtitle: 'See how VicPods shapes different podcast styles before you ever create an account.',
    view: 'tools/example-library',
    data: {
      publicShell: true,
      effectivePlan: req.effectivePlan || req.currentUser?.plan || 'free',
      ...seo,
      ...pageData,
    },
  });
}

module.exports = {
  buildPublicPricingPlans,
  buildPricingPageData,
  showLanding,
  showPricing,
  showPodcastIdeaGenerator,
  showExampleLibrary,
};
