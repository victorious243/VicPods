const WORKSPACE_PLAN_KEYS = ['free', 'creator', 'growth', 'studio'];
const HOSTING_PLAN_KEYS = ['none', 'starter', 'growth', 'studio'];

const WORKSPACE_PRIORITY = {
  free: 0,
  creator: 1,
  growth: 2,
  studio: 3,
};

const HOSTING_PRIORITY = {
  none: 0,
  starter: 1,
  growth: 2,
  studio: 3,
};

const LEGACY_TO_WORKSPACE_PLAN = {
  free: 'free',
  pro: 'creator',
  premium: 'growth',
};

const WORKSPACE_TO_LEGACY_PLAN = {
  free: 'free',
  creator: 'pro',
  growth: 'premium',
  studio: 'premium',
};

const INCLUDED_HOSTING_BY_WORKSPACE = {
  free: 'none',
  creator: 'starter',
  growth: 'growth',
  studio: 'studio',
};

function toNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value || '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatAmount(amount) {
  return amount === 0 ? '0' : amount.toFixed(2);
}

function normalizeWorkspacePlan(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (WORKSPACE_PLAN_KEYS.includes(normalized)) {
    return normalized;
  }

  return LEGACY_TO_WORKSPACE_PLAN[normalized] || 'free';
}

function normalizeHostingPlan(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return HOSTING_PLAN_KEYS.includes(normalized) ? normalized : 'none';
}

function getWorkspacePlanForLegacyPlan(value) {
  return LEGACY_TO_WORKSPACE_PLAN[String(value || '').trim().toLowerCase()] || 'free';
}

function getLegacyPlanForWorkspacePlan(value) {
  return WORKSPACE_TO_LEGACY_PLAN[normalizeWorkspacePlan(value)] || 'free';
}

function maxHostingPlan(left, right) {
  const normalizedLeft = normalizeHostingPlan(left);
  const normalizedRight = normalizeHostingPlan(right);
  return HOSTING_PRIORITY[normalizedRight] > HOSTING_PRIORITY[normalizedLeft]
    ? normalizedRight
    : normalizedLeft;
}

function getIncludedHostingPlan(workspacePlan) {
  return INCLUDED_HOSTING_BY_WORKSPACE[normalizeWorkspacePlan(workspacePlan)] || 'none';
}

function getWorkspacePlanDefinitions() {
  return [
    {
      key: 'free',
      title: 'Free',
      priceEnv: 'BILLING_PRICE_WORKSPACE_FREE',
      fallbackPrice: 0,
      stripeEnv: '',
      summary: 'Try the planning workflow before publishing live.',
      limits: {
        aiActionsPerDay: 5,
        savedEpisodes: 3,
        hostedShows: 0,
        collaborators: 0,
      },
      features: [
        'Public generator and core planning workspace',
        'One draft show workspace',
        'Up to 3 saved episodes',
        'No live podcast hosting',
      ],
    },
    {
      key: 'creator',
      title: 'Creator',
      priceEnv: 'BILLING_PRICE_WORKSPACE_CREATOR',
      fallbackPrice: 19,
      stripeEnv: 'STRIPE_PRICE_WORKSPACE_CREATOR',
      fallbackStripeEnv: 'STRIPE_PRICE_PRO',
      summary: 'One weekly show from idea to published episode.',
      limits: {
        aiActionsPerDay: 50,
        savedEpisodes: 100,
        hostedShows: 1,
        collaborators: 0,
      },
      features: [
        'One hosted show with RSS, public page, and scheduling',
        'Standard analytics and weekly workflow tools',
        'Promotion pack and show notes',
        '4 upload hours per month included',
      ],
    },
    {
      key: 'growth',
      title: 'Growth',
      priceEnv: 'BILLING_PRICE_WORKSPACE_GROWTH',
      fallbackPrice: 39,
      stripeEnv: 'STRIPE_PRICE_WORKSPACE_GROWTH',
      fallbackStripeEnv: 'STRIPE_PRICE_PREMIUM',
      summary: 'Commercial creators who publish, promote, and measure.',
      limits: {
        aiActionsPerDay: 150,
        savedEpisodes: 300,
        hostedShows: 3,
        collaborators: 3,
      },
      features: [
        'Three hosted shows with custom-domain tools',
        'Advanced analytics recommendations',
        'Sponsor kit, private-feed setup, and promotion assets',
        '3 collaborators included',
      ],
    },
    {
      key: 'studio',
      title: 'Studio',
      priceEnv: 'BILLING_PRICE_WORKSPACE_STUDIO',
      fallbackPrice: 89,
      stripeEnv: 'STRIPE_PRICE_WORKSPACE_STUDIO',
      summary: 'Small teams and agencies operating several shows.',
      limits: {
        aiActionsPerDay: Infinity,
        savedEpisodes: Infinity,
        hostedShows: 10,
        collaborators: 10,
      },
      features: [
        'Ten hosted shows and ten seats',
        'Approvals, webhooks, reports, and client-ready workflows',
        'Priority production controls',
        'Higher hosting and media limits',
      ],
    },
  ];
}

function getHostingPlanDefinitions() {
  return [
    {
      key: 'none',
      title: 'No Hosting',
      priceEnv: 'BILLING_PRICE_HOSTING_NONE',
      fallbackPrice: 0,
      stripeEnv: '',
      summary: 'Planning-only access.',
      limits: {
        hostedShows: 0,
        storageGb: 0,
        uploadHoursPerMonth: 0,
        monthlyDownloads: 0,
        collaborators: 0,
        privateSubscribers: 0,
      },
    },
    {
      key: 'starter',
      title: 'Starter Hosting',
      priceEnv: 'BILLING_PRICE_HOSTING_STARTER',
      fallbackPrice: 9,
      stripeEnv: 'STRIPE_PRICE_HOSTING_STARTER',
      summary: 'One serious show with reliable publishing basics.',
      limits: {
        hostedShows: 1,
        storageGb: 20,
        uploadHoursPerMonth: 4,
        monthlyDownloads: 20000,
        collaborators: 0,
        privateSubscribers: 0,
      },
    },
    {
      key: 'growth',
      title: 'Growth Hosting',
      priceEnv: 'BILLING_PRICE_HOSTING_GROWTH',
      fallbackPrice: 19,
      stripeEnv: 'STRIPE_PRICE_HOSTING_GROWTH',
      summary: 'Multiple shows with more bandwidth and collaborators.',
      limits: {
        hostedShows: 3,
        storageGb: 100,
        uploadHoursPerMonth: 12,
        monthlyDownloads: 100000,
        collaborators: 3,
        privateSubscribers: 100,
      },
    },
    {
      key: 'studio',
      title: 'Studio Hosting',
      priceEnv: 'BILLING_PRICE_HOSTING_STUDIO',
      fallbackPrice: 49,
      stripeEnv: 'STRIPE_PRICE_HOSTING_STUDIO',
      summary: 'Network-scale hosting for agencies and brand teams.',
      limits: {
        hostedShows: 10,
        storageGb: 500,
        uploadHoursPerMonth: 40,
        monthlyDownloads: 500000,
        collaborators: 10,
        privateSubscribers: 1000,
      },
    },
  ];
}

function getPlanDefinition(productType, planKey) {
  const collection = productType === 'hosting'
    ? getHostingPlanDefinitions()
    : getWorkspacePlanDefinitions();
  const normalizedPlan = productType === 'hosting'
    ? normalizeHostingPlan(planKey)
    : normalizeWorkspacePlan(planKey);

  return collection.find((plan) => plan.key === normalizedPlan) || collection[0];
}

function getPlanPrice(planDefinition) {
  return toNumber(process.env[planDefinition.priceEnv], planDefinition.fallbackPrice);
}

function getPlanStripePriceId(planDefinition) {
  return String(
    process.env[planDefinition.stripeEnv]
    || (planDefinition.fallbackStripeEnv ? process.env[planDefinition.fallbackStripeEnv] : '')
    || ''
  ).trim();
}

function formatPlanPrice(planDefinition, { currencySymbol = '€', intervalLabel = '/mo' } = {}) {
  const amount = getPlanPrice(planDefinition);
  return `${currencySymbol}${formatAmount(amount)}${amount > 0 ? intervalLabel : ''}`;
}

module.exports = {
  HOSTING_PLAN_KEYS,
  HOSTING_PRIORITY,
  INCLUDED_HOSTING_BY_WORKSPACE,
  LEGACY_TO_WORKSPACE_PLAN,
  WORKSPACE_PLAN_KEYS,
  WORKSPACE_PRIORITY,
  WORKSPACE_TO_LEGACY_PLAN,
  formatPlanPrice,
  getHostingPlanDefinitions,
  getIncludedHostingPlan,
  getLegacyPlanForWorkspacePlan,
  getPlanDefinition,
  getPlanPrice,
  getPlanStripePriceId,
  getWorkspacePlanDefinitions,
  getWorkspacePlanForLegacyPlan,
  maxHostingPlan,
  normalizeHostingPlan,
  normalizeWorkspacePlan,
};
