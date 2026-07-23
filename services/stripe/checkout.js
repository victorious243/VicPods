const { getStripeClient } = require('./stripeClient');
const { assertSupportedPlan } = require('./planMapping');
const { AppError } = require('../../utils/errors');

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

function hasActiveProductSubscription(user, productType, now = new Date()) {
  if (!user) {
    return false;
  }

  const subscriptionId = productType === 'hosting'
    ? user.stripeHostingSubscriptionId
    : (user.stripeWorkspaceSubscriptionId || user.stripeSubscriptionId);
  const status = productType === 'hosting'
    ? user.hostingPlanStatus
    : (user.workspacePlanStatus || user.planStatus);
  const periodEnd = productType === 'hosting'
    ? user.hostingCurrentPeriodEnd
    : (user.workspaceCurrentPeriodEnd || user.currentPeriodEnd);

  if (!subscriptionId || !ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || '').trim().toLowerCase())) {
    return false;
  }

  if (!periodEnd) {
    return true;
  }

  return new Date(periodEnd).getTime() > now.getTime();
}

async function createCheckoutSession({ user, plan, productType = 'workspace', appUrl }) {
  const stripe = getStripeClient();
  const {
    productType: normalizedProductType,
    plan: normalizedPlan,
    legacyPlan,
    priceId,
  } = assertSupportedPlan(plan, productType);

  if (hasActiveProductSubscription(user, normalizedProductType)) {
    throw new AppError(
      normalizedProductType === 'hosting'
        ? 'You already have an active hosting subscription. Use Manage Billing to change or cancel it.'
        : 'You already have an active workspace subscription. Use Manage Billing to change or cancel it.',
      409
    );
  }

  const payload = {
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing/cancel`,
    client_reference_id: user._id.toString(),
    metadata: {
      userId: user._id.toString(),
      productType: normalizedProductType,
      planSelected: normalizedPlan,
      legacyPlanSelected: legacyPlan,
    },
    subscription_data: {
      metadata: {
        userId: user._id.toString(),
        productType: normalizedProductType,
        planSelected: normalizedPlan,
        legacyPlanSelected: legacyPlan,
      },
    },
    allow_promotion_codes: true,
  };

  if (user.stripeCustomerId) {
    payload.customer = user.stripeCustomerId;
  } else {
    payload.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(payload);
  return {
    ...session,
    source: 'checkout_session',
  };
}

module.exports = {
  createCheckoutSession,
  hasActiveProductSubscription,
};
