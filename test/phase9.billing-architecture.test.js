const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const User = require('../models/User');
const { buildPublicPricingPlans } = require('../controllers/landingController');
const { buildPricingPageData } = require('../controllers/landingController');
const {
  hasActiveHostingSubscription,
  requirePublishingAccess,
  resolveEffectiveWorkspacePlan,
} = require('../middleware/requirePlan');
const {
  getIncludedHostingPlan,
  getHostingPlanDefinitions,
  getLegacyPlanForWorkspacePlan,
  getWorkspacePlanDefinitions,
  maxHostingPlan,
} = require('../services/billing/planCatalog');
const {
  buildUsageMetric,
  getEffectiveHostingPlanForBilling,
} = require('../services/billing/usageLimitsService');
const {
  findBestSubscriptionCandidatesByProduct,
} = require('../services/stripe/billingReconciliation');
const {
  assertSupportedPlan,
  mapPriceIdToBillingSelection,
  normalizeBillingSelectionPlan,
  normalizePlanInput,
} = require('../services/stripe/planMapping');
const { hasActiveProductSubscription } = require('../services/stripe/checkout');
const {
  buildPaymentLinkCheckout,
  parsePaymentLinkClientReferenceId,
} = require('../services/stripe/paymentLinks');
const {
  applySubscriptionToUser,
  findBillingSelectionFromCheckoutSession,
  handleStripeEvent,
  syncCheckoutSessionToUser,
} = require('../services/stripe/webhookHandlers');
const {
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
} = require('../services/stripe/stripeObjectCompat');
const { getPricingDisplay } = require('../services/billing/pricing');
const { getIndexablePublicPages } = require('../services/seo/siteSeoService');

test('Phase 9 billing catalog separates workspace and hosting plans', () => {
  const plans = getWorkspacePlanDefinitions();
  const hostingPlans = getHostingPlanDefinitions();

  assert.deepEqual(plans.map((plan) => plan.key), ['free', 'creator', 'growth', 'studio']);
  assert.equal(getLegacyPlanForWorkspacePlan('creator'), 'pro');
  assert.equal(getLegacyPlanForWorkspacePlan('growth'), 'premium');
  assert.equal(getIncludedHostingPlan('creator'), 'starter');
  assert.equal(getIncludedHostingPlan('growth'), 'growth');
  assert.equal(maxHostingPlan('starter', 'growth'), 'growth');
  assert.equal(hostingPlans.find((plan) => plan.key === 'growth').limits.privateSubscribers, 100);
});

test('Phase 9 Stripe plan mapping supports product families', () => {
  const originalEnv = { ...process.env };

  try {
    process.env.STRIPE_PRICE_WORKSPACE_CREATOR = 'price_workspace_creator';
    process.env.STRIPE_PRICE_HOSTING_GROWTH = 'price_hosting_growth';

    assert.equal(normalizePlanInput('creator', 'workspace'), 'creator');
    assert.equal(normalizePlanInput('growth', 'hosting'), 'growth');
    assert.deepEqual(assertSupportedPlan('creator', 'workspace'), {
      productType: 'workspace',
      plan: 'creator',
      legacyPlan: 'pro',
      priceId: 'price_workspace_creator',
    });
    assert.deepEqual(mapPriceIdToBillingSelection('price_hosting_growth'), {
      productType: 'hosting',
      plan: 'growth',
      legacyPlan: 'free',
    });
  } finally {
    process.env = originalEnv;
  }
});

test('Phase 9 legacy Stripe metadata maps to new workspace plan keys', async () => {
  const user = {
    stripeCustomerId: '',
    saveCalled: false,
    async save() {
      this.saveCalled = true;
    },
  };
  const futurePeriodEnd = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);

  assert.deepEqual(normalizeBillingSelectionPlan('pro', 'workspace'), {
    productType: 'workspace',
    plan: 'creator',
    legacyPlan: 'pro',
  });
  assert.deepEqual(normalizeBillingSelectionPlan('premium', 'workspace'), {
    productType: 'workspace',
    plan: 'growth',
    legacyPlan: 'premium',
  });

  await applySubscriptionToUser(user, {
    id: 'sub_legacy_pro',
    customer: 'cus_123',
    status: 'active',
    current_period_start: futurePeriodEnd - 3600,
    current_period_end: futurePeriodEnd,
    cancel_at_period_end: false,
    metadata: {
      productType: 'workspace',
      planSelected: 'pro',
    },
    items: { data: [{ price: { id: 'price_unknown_legacy' } }] },
  });

  assert.equal(user.workspacePlan, 'creator');
  assert.equal(user.plan, 'pro');
  assert.equal(user.saveCalled, true);
});

test('Phase 9 Stripe Clover objects expose invoice subscriptions and periods', () => {
  const subscription = {
    items: {
      data: [
        {
          current_period_start: 1760000000,
          current_period_end: 1762000000,
        },
      ],
    },
  };

  assert.equal(getInvoiceSubscriptionId({
    parent: {
      type: 'subscription_details',
      subscription_details: {
        subscription: 'sub_clover',
      },
    },
  }), 'sub_clover');
  assert.equal(getSubscriptionPeriod(subscription).currentPeriodStartUnix, 1760000000);
  assert.equal(getSubscriptionPeriod(subscription).currentPeriodEndUnix, 1762000000);
});

test('Phase 9 past-due subscriptions retain access during the payment recovery window', async () => {
  const previousGraceDays = process.env.BILLING_PAYMENT_GRACE_DAYS;
  const user = {
    stripeCustomerId: '',
    async save() {},
  };
  const now = Date.now();

  try {
    process.env.BILLING_PAYMENT_GRACE_DAYS = '7';
    await applySubscriptionToUser(user, {
      id: 'sub_clover_past_due',
      customer: 'cus_clover',
      status: 'past_due',
      cancel_at_period_end: false,
      metadata: {
        productType: 'workspace',
        planSelected: 'creator',
      },
      items: {
        data: [{
          current_period_start: Math.floor(now / 1000) - 3600,
          current_period_end: Math.floor(now / 1000),
          price: { id: 'price_clover_creator' },
        }],
      },
    });

    assert.equal(user.workspacePlan, 'creator');
    assert.equal(user.plan, 'pro');
    assert.equal(user.workspacePlanStatus, 'past_due');
    assert.ok(user.workspacePaymentGraceUntil.getTime() > now);
    assert.equal(resolveEffectiveWorkspacePlan(user, new Date(now)), 'creator');

    user.workspacePaymentGraceUntil = new Date(now - 1);
    assert.equal(resolveEffectiveWorkspacePlan(user, new Date(now)), 'free');
    const expiredGrace = user.workspacePaymentGraceUntil.getTime();
    await applySubscriptionToUser(user, {
      id: 'sub_clover_past_due',
      customer: 'cus_clover',
      status: 'past_due',
      metadata: {
        productType: 'workspace',
        planSelected: 'creator',
      },
      items: {
        data: [{
          current_period_start: Math.floor(now / 1000) - 3600,
          current_period_end: Math.floor(now / 1000),
          price: { id: 'price_clover_creator' },
        }],
      },
    });
    assert.equal(user.workspacePaymentGraceUntil.getTime(), expiredGrace);
  } finally {
    if (previousGraceDays === undefined) {
      delete process.env.BILLING_PAYMENT_GRACE_DAYS;
    } else {
      process.env.BILLING_PAYMENT_GRACE_DAYS = previousGraceDays;
    }
  }
});

test('Phase 9 payment-action and finalization webhooks are handled explicitly', async () => {
  const originalFindOne = User.findOne;
  const user = {
    stripeCustomerId: 'cus_attention',
    plan: 'pro',
    workspacePlan: 'creator',
    stripeWorkspaceSubscriptionId: '',
    lastPaymentFailureEmailInvoiceId: 'in_action',
    saveCount: 0,
    async save() {
      this.saveCount += 1;
    },
  };

  try {
    User.findOne = async () => user;

    await handleStripeEvent({
      type: 'invoice.payment_action_required',
      data: {
        object: {
          id: 'in_action',
          customer: 'cus_attention',
          attempt_count: 2,
          next_payment_attempt: 1762000000,
        },
      },
    });

    assert.equal(user.billingAttentionReason, 'payment_action_required');
    assert.equal(user.workspacePlanStatus, 'past_due');
    assert.ok(user.workspacePaymentGraceUntil instanceof Date);

    await handleStripeEvent({
      type: 'invoice.finalization_failed',
      data: {
        object: {
          id: 'in_finalization',
          customer: 'cus_attention',
        },
      },
    });

    assert.equal(user.billingAttentionReason, 'invoice_finalization_failed');
    assert.ok(user.saveCount >= 2);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('Phase 9 reconciliation can select separate workspace and hosting subscriptions', async () => {
  const originalEnv = { ...process.env };
  const user = {
    _id: new mongoose.Types.ObjectId(),
    email: 'creator@example.com',
    stripeWorkspaceSubscriptionId: 'sub_workspace',
    stripeHostingSubscriptionId: 'sub_hosting',
  };
  const futurePeriodEnd = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);
  const subscriptions = {
    sub_workspace: {
      id: 'sub_workspace',
      customer: 'cus_workspace',
      status: 'active',
      current_period_end: futurePeriodEnd,
      metadata: { userId: user._id.toString(), productType: 'workspace' },
      items: { data: [{ price: { id: 'price_workspace_creator' } }] },
      created: 1,
    },
    sub_hosting: {
      id: 'sub_hosting',
      customer: 'cus_hosting',
      status: 'past_due',
      current_period_end: futurePeriodEnd,
      metadata: { userId: user._id.toString(), productType: 'hosting' },
      items: { data: [{ price: { id: 'price_hosting_growth' } }] },
      created: 2,
    },
  };
  const stripe = {
    subscriptions: {
      retrieve: async (id) => subscriptions[id],
    },
    customers: {
      retrieve: async (id) => ({ id, email: user.email, metadata: { userId: user._id.toString() } }),
      list: async () => ({ data: [] }),
    },
  };

  try {
    process.env.STRIPE_PRICE_WORKSPACE_CREATOR = 'price_workspace_creator';
    process.env.STRIPE_PRICE_HOSTING_GROWTH = 'price_hosting_growth';

    const candidates = await findBestSubscriptionCandidatesByProduct(stripe, user);

    assert.equal(candidates.workspace.subscription.id, 'sub_workspace');
    assert.equal(candidates.hosting.subscription.id, 'sub_hosting');
  } finally {
    process.env = originalEnv;
  }
});

test('Phase 9 public landing pricing uses workspace plan names', () => {
  const plans = buildPublicPricingPlans({
    free: '€0',
    pro: '€19/mo',
    premium: '€39/mo',
    workspacePlans: [
      { key: 'free', price: '€0' },
      { key: 'creator', price: '€19/mo' },
      { key: 'growth', price: '€39/mo' },
    ],
  });

  assert.deepEqual(plans.map((plan) => plan.key), ['free', 'creator', 'growth']);
  assert.deepEqual(plans.map((plan) => plan.title), ['Free', 'Creator', 'Growth']);
  assert.ok(plans.every((plan) => !String(plan.note || '').includes('undefined')));
});

test('Phase 9 public pricing page explains included hosting tiers', () => {
  const page = buildPricingPageData(getPricingDisplay());

  assert.ok(page.workspacePlans.some((plan) => plan.key === 'creator' && plan.includedHostingKey === 'starter'));
  assert.ok(page.workspacePlans.some((plan) => plan.key === 'growth' && plan.includedHostingKey === 'growth'));
  assert.ok(page.hostingAddOns.some((plan) => plan.key === 'starter' && plan.includedByWorkspace.includes('Creator')));
  assert.ok(page.billingNotes.some((note) => note.title.includes('Most creators')));
  assert.ok(getIndexablePublicPages().some((pageItem) => pageItem.path === '/pricing'));
});

test('Phase 9 publishing access allows active hosting-only customers', async () => {
  const req = {
    currentUser: {
      plan: 'free',
      workspacePlan: 'free',
      hostingPlan: 'starter',
      hostingPlanStatus: 'active',
      hostingCurrentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    },
    accepts: () => true,
  };
  const res = { locals: {} };
  let nextCalled = false;

  await requirePublishingAccess(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.effectiveHostingPlan, 'starter');
});

test('Phase 9 checkout refuses a second active subscription for the same product family', () => {
  const user = {
    stripeWorkspaceSubscriptionId: 'sub_workspace',
    workspacePlanStatus: 'active',
    workspaceCurrentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
    stripeHostingSubscriptionId: 'sub_hosting',
    hostingPlanStatus: 'active',
    hostingCurrentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
  };

  assert.equal(hasActiveProductSubscription(user, 'workspace'), true);
  assert.equal(hasActiveProductSubscription(user, 'hosting'), true);
  assert.equal(hasActiveProductSubscription({
    stripeWorkspaceSubscriptionId: 'sub_old',
    workspacePlanStatus: 'canceled',
    workspaceCurrentPeriodEnd: new Date('2024-01-01T00:00:00.000Z'),
  }, 'workspace'), false);
});

test('Phase 9 Payment Links carry a signed account and plan reference', () => {
  const previousLink = process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH;
  const previousSecret = process.env.SESSION_SECRET;

  try {
    process.env.SESSION_SECRET = 'test-payment-link-signing-secret-with-32-characters';
    process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH = 'https://buy.stripe.com/test_growth_host';

    const checkout = buildPaymentLinkCheckout({
      user: {
        _id: '507f1f77bcf86cd799439011',
        email: 'Creator+Billing@Example.com',
      },
      productType: 'hosting',
      plan: 'growth',
    });
    const url = new URL(checkout.url);
    const reference = url.searchParams.get('client_reference_id');

    assert.equal(checkout.source, 'payment_link');
    assert.equal(url.origin, 'https://buy.stripe.com');
    assert.equal(url.searchParams.get('locked_prefilled_email'), 'creator+billing@example.com');
    assert.deepEqual(parsePaymentLinkClientReferenceId(reference), {
      userId: '507f1f77bcf86cd799439011',
      productType: 'hosting',
      plan: 'growth',
    });
    assert.equal(
      parsePaymentLinkClientReferenceId(reference.replace('growth', 'studio')),
      null
    );
  } finally {
    if (previousLink === undefined) {
      delete process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH;
    } else {
      process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH = previousLink;
    }
    if (previousSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = previousSecret;
    }
  }
});

test('Phase 9 Payment Link checkout references identify metadata-free subscriptions', () => {
  const previousSecret = process.env.SESSION_SECRET;

  try {
    process.env.SESSION_SECRET = 'test-payment-link-signing-secret-with-32-characters';
    process.env.STRIPE_PAYMENT_LINK_WORKSPACE_STUDIO = 'https://buy.stripe.com/test_workspace_studio';
    const checkout = buildPaymentLinkCheckout({
      user: {
        _id: '507f1f77bcf86cd799439012',
        email: 'studio@example.com',
      },
      productType: 'workspace',
      plan: 'studio',
    });
    const clientReferenceId = new URL(checkout.url).searchParams.get('client_reference_id');

    assert.deepEqual(findBillingSelectionFromCheckoutSession({
      client_reference_id: clientReferenceId,
      metadata: {},
    }, {
      metadata: {},
      items: { data: [{ price: { id: 'price_not_configured_locally' } }] },
    }), {
      productType: 'workspace',
      plan: 'studio',
      legacyPlan: 'premium',
    });
  } finally {
    delete process.env.STRIPE_PAYMENT_LINK_WORKSPACE_STUDIO;
    if (previousSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = previousSecret;
    }
  }
});

test('Phase 9 metadata-free Hosting Payment Links activate and label the subscription', async () => {
  const previousLink = process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH;
  const previousSecret = process.env.SESSION_SECRET;

  try {
    process.env.SESSION_SECRET = 'test-payment-link-signing-secret-with-32-characters';
    process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH = 'https://buy.stripe.com/test_growth_host';
    const user = {
      _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
      email: 'hosting@example.com',
      stripeCustomerId: '',
      saveCount: 0,
      async save() {
        this.saveCount += 1;
      },
    };
    const checkout = buildPaymentLinkCheckout({
      user,
      productType: 'hosting',
      plan: 'growth',
    });
    const clientReferenceId = new URL(checkout.url).searchParams.get('client_reference_id');
    const futurePeriodEnd = Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000);
    const subscription = {
      id: 'sub_payment_link_hosting',
      customer: 'cus_payment_link',
      status: 'active',
      current_period_start: futurePeriodEnd - 3600,
      current_period_end: futurePeriodEnd,
      cancel_at_period_end: false,
      metadata: {},
      items: { data: [{ price: { id: 'price_unknown_hosting' } }] },
    };
    let writtenMetadata = null;
    const stripe = {
      subscriptions: {
        retrieve: async () => subscription,
        update: async (_id, payload) => {
          writtenMetadata = payload.metadata;
          return {
            ...subscription,
            metadata: payload.metadata,
          };
        },
      },
    };

    const result = await syncCheckoutSessionToUser(user, {
      mode: 'subscription',
      client_reference_id: clientReferenceId,
      customer: 'cus_payment_link',
      subscription: 'sub_payment_link_hosting',
      metadata: {},
    }, { stripe });

    assert.equal(result.synced, true);
    assert.equal(user.hostingPlan, 'growth');
    assert.equal(user.hostingPlanStatus, 'active');
    assert.equal(user.stripeHostingSubscriptionId, 'sub_payment_link_hosting');
    assert.equal(user.stripeWorkspaceSubscriptionId, undefined);
    assert.deepEqual(writtenMetadata, {
      userId: user._id.toString(),
      productType: 'hosting',
      planSelected: 'growth',
      legacyPlanSelected: 'free',
    });
  } finally {
    if (previousLink === undefined) {
      delete process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH;
    } else {
      process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH = previousLink;
    }
    if (previousSecret === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = previousSecret;
    }
  }
});

test('Phase 9 stale subscription.deleted webhook does not clear current paid access', async () => {
  const originalFindOne = User.findOne;
  const user = {
    stripeCustomerId: 'cus_123',
    stripeWorkspaceSubscriptionId: 'sub_new',
    stripeSubscriptionId: 'sub_new',
    workspacePlan: 'growth',
    workspacePlanStatus: 'active',
    plan: 'premium',
    planStatus: 'active',
    saveCalled: false,
    async save() {
      this.saveCalled = true;
    },
  };

  try {
    User.findOne = async () => user;

    await handleStripeEvent({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_old',
          customer: 'cus_123',
          status: 'canceled',
          current_period_start: 1760000000,
          current_period_end: 1762000000,
          metadata: {
            productType: 'workspace',
            planSelected: 'creator',
          },
          items: { data: [{ price: { id: 'price_old' } }] },
        },
      },
    });

    assert.equal(user.workspacePlan, 'growth');
    assert.equal(user.plan, 'premium');
    assert.equal(user.stripeWorkspaceSubscriptionId, 'sub_new');
    assert.equal(user.saveCalled, true);
  } finally {
    User.findOne = originalFindOne;
  }
});

test('Phase 9 hosting capacity resolves included and paid hosting', () => {
  assert.equal(getEffectiveHostingPlanForBilling({
    workspacePlan: 'creator',
    hostingPlan: 'none',
    hostingActive: false,
  }), 'starter');
  assert.equal(getEffectiveHostingPlanForBilling({
    workspacePlan: 'creator',
    hostingPlan: 'growth',
    hostingActive: true,
  }), 'growth');
  assert.equal(hasActiveHostingSubscription({
    hostingPlanStatus: 'past_due',
    hostingPaymentGraceUntil: new Date('2099-01-01T00:00:00.000Z'),
  }), true);
});

test('Phase 9 usage metrics expose percent and limit state', () => {
  const metric = buildUsageMetric({
    key: 'hostedShows',
    label: 'Hosted shows',
    used: 3,
    limit: 3,
  });

  assert.equal(metric.percent, 100);
  assert.equal(metric.atLimit, true);
});

test('Phase 9 user schema exposes split billing fields', () => {
  assert.ok(User.schema.paths.workspacePlan);
  assert.ok(User.schema.paths.hostingPlan);
  assert.ok(User.schema.paths.workspacePlanStatus);
  assert.ok(User.schema.paths.hostingPlanStatus);
  assert.ok(User.schema.paths.stripeWorkspaceSubscriptionId);
  assert.ok(User.schema.paths.stripeHostingSubscriptionId);
  assert.ok(User.schema.paths.workspacePaymentGraceUntil);
  assert.ok(User.schema.paths.hostingPaymentGraceUntil);
  assert.ok(User.schema.paths.billingAttentionReason);
});

test.after(async () => {
  await mongoose.disconnect().catch(() => {});
});
