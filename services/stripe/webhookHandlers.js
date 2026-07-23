const User = require('../../models/User');
const {
  isPrivateFeedCheckoutSession,
  isPrivateFeedSubscription,
  syncPrivateFeedEntitlementFromCheckoutSession,
  syncPrivateFeedEntitlementFromSubscription,
} = require('../monetization/privateFeedEntitlementService');
const { sendPaymentFailedEmailIfNeeded, sendPaymentSuccessEmailIfNeeded } = require('../billing/paymentEmailService');
const {
  mapPriceIdToBillingSelection,
  normalizeBillingSelectionPlan,
  normalizeProductType,
} = require('./planMapping');
const { parsePaymentLinkClientReferenceId } = require('./paymentLinks');
const { getStripeClient } = require('./stripeClient');
const {
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
  toDate,
} = require('./stripeObjectCompat');

const ACTIVE_LIKE = new Set(['active', 'trialing']);
const DEFAULT_PAYMENT_GRACE_DAYS = 7;

function getPaymentGraceDays() {
  const parsed = Number.parseInt(String(process.env.BILLING_PAYMENT_GRACE_DAYS || ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 30
    ? parsed
    : DEFAULT_PAYMENT_GRACE_DAYS;
}

function getPaymentGraceUntil(existingValue, now = new Date()) {
  const existing = existingValue ? new Date(existingValue) : null;
  if (existing && !Number.isNaN(existing.getTime())) {
    return existing;
  }

  return new Date(now.getTime() + (getPaymentGraceDays() * 24 * 60 * 60 * 1000));
}

function isCurrentBillingSubscription(user, subscription, billingSelection) {
  const subscriptionId = String(subscription?.id || '').trim();
  if (!subscriptionId) {
    return true;
  }

  if (billingSelection.productType === 'hosting') {
    return !user.stripeHostingSubscriptionId
      || String(user.stripeHostingSubscriptionId) === subscriptionId;
  }

  const currentIds = [
    user.stripeWorkspaceSubscriptionId,
    user.stripeSubscriptionId,
  ].filter(Boolean).map(String);

  return !currentIds.length || currentIds.includes(subscriptionId);
}

function getPaymentEmailPlan(billingSelection) {
  return billingSelection.productType === 'hosting'
    ? `hosting-${billingSelection.plan}`
    : billingSelection.plan;
}

function clearBillingAttention(user) {
  user.billingAttentionReason = '';
  user.billingAttentionAt = null;
  user.billingNextPaymentAttemptAt = null;
  user.billingPaymentAttemptCount = 0;
}

function setBillingAttention(user, invoice, reason) {
  user.billingAttentionReason = reason;
  user.billingAttentionAt = new Date();
  user.billingNextPaymentAttemptAt = toDate(invoice?.next_payment_attempt);
  user.billingPaymentAttemptCount = Math.max(0, Number(invoice?.attempt_count || 0));
}

function findBillingSelectionFromSubscription(subscription) {
  const items = subscription?.items?.data || [];
  const priceId = items[0]?.price?.id;
  const mappedSelection = mapPriceIdToBillingSelection(priceId);
  const metadataProductType = normalizeProductType(subscription?.metadata?.productType);
  const metadataPlan = String(subscription?.metadata?.planSelected || '').trim().toLowerCase();

  if (metadataPlan) {
    const normalizedMetadataSelection = normalizeBillingSelectionPlan(metadataPlan, metadataProductType);
    return {
      ...mappedSelection,
      ...normalizedMetadataSelection,
    };
  }

  return mappedSelection;
}

function findBillingSelectionFromCheckoutSession(session, subscription) {
  const subscriptionSelection = findBillingSelectionFromSubscription(subscription);
  const sessionPlan = String(session?.metadata?.planSelected || '').trim().toLowerCase();
  const paymentLinkReference = parsePaymentLinkClientReferenceId(session?.client_reference_id);

  if (sessionPlan) {
    return normalizeBillingSelectionPlan(
      sessionPlan,
      normalizeProductType(session?.metadata?.productType)
    );
  }

  if (paymentLinkReference) {
    return normalizeBillingSelectionPlan(
      paymentLinkReference.plan,
      paymentLinkReference.productType
    );
  }

  return subscriptionSelection;
}

function shouldDowngrade({ plan, status, currentPeriodEnd }) {
  if (plan === 'free') {
    return true;
  }

  if (!ACTIVE_LIKE.has(status)) {
    return true;
  }

  if (!currentPeriodEnd) {
    return true;
  }

  return currentPeriodEnd.getTime() <= Date.now();
}

async function findUserForCheckoutSession(session) {
  const paymentLinkReference = parsePaymentLinkClientReferenceId(session?.client_reference_id);
  const userId = paymentLinkReference?.userId
    || session.client_reference_id
    || session.metadata?.userId;

  if (!userId) {
    return null;
  }

  if (String(session.client_reference_id || '').startsWith('vp--') && !paymentLinkReference) {
    return null;
  }

  return User.findById(userId);
}

async function findUserForSubscription(subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  const subscriptionId = subscription.id;

  let user = null;

  if (customerId) {
    user = await User.findOne({ stripeCustomerId: customerId });
  }

  if (!user && subscriptionId) {
    user = await User.findOne({
      $or: [
        { stripeSubscriptionId: subscriptionId },
        { stripeWorkspaceSubscriptionId: subscriptionId },
        { stripeHostingSubscriptionId: subscriptionId },
      ],
    });
  }

  if (!user && subscription.metadata?.userId) {
    user = await User.findById(subscription.metadata.userId);
  }

  return user;
}

async function applySubscriptionToUser(user, subscription, options = {}) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  const status = subscription.status || 'canceled';
  const billingSelection = options.billingSelection || findBillingSelectionFromSubscription(subscription);
  const planFromPrice = billingSelection.legacyPlan;
  const {
    currentPeriodStart,
    currentPeriodEnd,
  } = getSubscriptionPeriod(subscription);
  const isPastDue = status === 'past_due';

  const planShouldDowngrade = shouldDowngrade({
    plan: planFromPrice,
    status,
    currentPeriodEnd,
  }) && !isPastDue;
  const plan = planShouldDowngrade ? 'free' : planFromPrice;

  user.stripeCustomerId = customerId || user.stripeCustomerId;
  if (billingSelection.productType === 'hosting') {
    const hostingShouldDowngrade = shouldDowngrade({
      plan: billingSelection.plan,
      status,
      currentPeriodEnd,
    }) && !isPastDue;
    user.hostingPlan = hostingShouldDowngrade ? 'none' : billingSelection.plan;
    user.hostingPlanStatus = status;
    user.hostingCurrentPeriodStart = currentPeriodStart;
    user.hostingCurrentPeriodEnd = currentPeriodEnd;
    user.hostingCancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
    user.stripeHostingSubscriptionId = subscription.id || user.stripeHostingSubscriptionId;
    if (isPastDue) {
      user.hostingPaymentGraceUntil = getPaymentGraceUntil(user.hostingPaymentGraceUntil);
    } else {
      user.hostingPaymentGraceUntil = null;
    }
  } else {
    user.stripeSubscriptionId = subscription.id || user.stripeSubscriptionId;
    user.stripeWorkspaceSubscriptionId = subscription.id || user.stripeWorkspaceSubscriptionId;
    user.workspacePlan = plan === 'free' ? 'free' : billingSelection.plan;
    user.workspacePlanStatus = status;
    user.workspaceCurrentPeriodStart = currentPeriodStart;
    user.workspaceCurrentPeriodEnd = currentPeriodEnd;
    user.plan = plan;
    user.planStatus = status;
    user.currentPeriodStart = currentPeriodStart;
    user.currentPeriodEnd = currentPeriodEnd;
    user.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
    if (isPastDue) {
      user.workspacePaymentGraceUntil = getPaymentGraceUntil(user.workspacePaymentGraceUntil);
    } else {
      user.workspacePaymentGraceUntil = null;
    }
  }
  if (ACTIVE_LIKE.has(status)) {
    clearBillingAttention(user);
  }
  user.billingLastSyncedAt = new Date();

  await user.save();
}

async function syncCheckoutSessionToUser(user, session, options = {}) {
  if (!user || !session || session.mode !== 'subscription') {
    return {
      synced: false,
      reason: 'not_subscription',
    };
  }

  const paymentLinkReference = parsePaymentLinkClientReferenceId(session.client_reference_id);
  const sessionUserId = String(
    paymentLinkReference?.userId
    || session.client_reference_id
    || session.metadata?.userId
    || ''
  ).trim();
  if (String(session.client_reference_id || '').startsWith('vp--') && !paymentLinkReference) {
    return {
      synced: false,
      reason: 'invalid_client_reference',
    };
  }

  if (sessionUserId && sessionUserId !== user._id.toString()) {
    return {
      synced: false,
      reason: 'user_mismatch',
    };
  }

  if (!session.subscription) {
    user.stripeCustomerId = session.customer || user.stripeCustomerId;
    await user.save();
    return {
      synced: false,
      reason: 'missing_subscription',
      user,
    };
  }

  const stripe = options.stripe || getStripeClient();
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id;
  let subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const billingSelection = findBillingSelectionFromCheckoutSession(session, subscription);
  const expectedMetadata = {
    userId: user._id.toString(),
    productType: billingSelection.productType,
    planSelected: billingSelection.plan,
    legacyPlanSelected: billingSelection.legacyPlan,
  };
  const metadataNeedsUpdate = Object.entries(expectedMetadata)
    .some(([key, value]) => String(subscription.metadata?.[key] || '') !== String(value || ''));

  if (metadataNeedsUpdate) {
    subscription = await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        ...(subscription.metadata || {}),
        ...expectedMetadata,
      },
    });
  }

  user.stripeCustomerId = session.customer || user.stripeCustomerId;
  if (billingSelection.productType === 'hosting') {
    user.stripeHostingSubscriptionId = subscriptionId;
  } else {
    user.stripeSubscriptionId = subscriptionId;
    user.stripeWorkspaceSubscriptionId = subscriptionId;
  }

  await applySubscriptionToUser(user, subscription, { billingSelection });

  return {
    synced: true,
    reason: 'subscription_applied',
    user,
    subscription,
  };
}

async function reconcileCheckoutSession({ sessionId, user }) {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(String(sessionId || '').trim());

  if (!user) {
    user = await findUserForCheckoutSession(session);
  }

  if (!user) {
    return {
      synced: false,
      reason: 'user_not_found',
      session,
      user: null,
      subscription: null,
    };
  }

  const syncResult = await syncCheckoutSessionToUser(user, session);
  return {
    ...syncResult,
    session,
  };
}

async function handleCheckoutSessionCompleted(session) {
  if (session.mode !== 'subscription') {
    return;
  }

  if (isPrivateFeedCheckoutSession(session)) {
    await syncPrivateFeedEntitlementFromCheckoutSession(session, {
      lastStripeEventType: 'checkout.session.completed',
    });
    return;
  }

  const user = await findUserForCheckoutSession(session);

  if (!user) {
    return;
  }

  await syncCheckoutSessionToUser(user, session);
}

async function handleSubscriptionCreatedOrUpdated(subscription) {
  if (isPrivateFeedSubscription(subscription)) {
    await syncPrivateFeedEntitlementFromSubscription(subscription, {
      lastStripeEventType: 'customer.subscription.updated',
    });
    return;
  }

  const user = await findUserForSubscription(subscription);

  if (!user) {
    return;
  }

  const billingSelection = findBillingSelectionFromSubscription(subscription);
  if (!isCurrentBillingSubscription(user, subscription, billingSelection)) {
    user.billingLastSyncedAt = new Date();
    await user.save();
    return;
  }

  await applySubscriptionToUser(user, subscription, { billingSelection });
}

async function handleSubscriptionDeleted(subscription) {
  if (isPrivateFeedSubscription(subscription)) {
    await syncPrivateFeedEntitlementFromSubscription(subscription, {
      entitlementStatus: 'canceled',
      lastStripeEventType: 'customer.subscription.deleted',
    });
    return;
  }

  const user = await findUserForSubscription(subscription);

  if (!user) {
    return;
  }

  user.stripeCustomerId = user.stripeCustomerId || subscription.customer;
  const billingSelection = findBillingSelectionFromSubscription(subscription);
  const {
    currentPeriodStart,
    currentPeriodEnd,
  } = getSubscriptionPeriod(subscription);

  if (billingSelection.productType === 'hosting') {
    if (
      user.stripeHostingSubscriptionId
      && String(user.stripeHostingSubscriptionId) !== String(subscription.id || '')
    ) {
      user.billingLastSyncedAt = new Date();
      await user.save();
      return;
    }

    user.stripeHostingSubscriptionId = null;
    user.hostingPlan = 'none';
    user.hostingPlanStatus = 'canceled';
    user.hostingCancelAtPeriodEnd = false;
    user.hostingCurrentPeriodStart = currentPeriodStart || user.hostingCurrentPeriodStart;
    user.hostingCurrentPeriodEnd = currentPeriodEnd || user.hostingCurrentPeriodEnd;
    user.hostingPaymentGraceUntil = null;
  } else {
    const currentWorkspaceSubscriptionIds = [
      user.stripeWorkspaceSubscriptionId,
      user.stripeSubscriptionId,
    ].filter(Boolean).map(String);

    if (
      currentWorkspaceSubscriptionIds.length
      && !currentWorkspaceSubscriptionIds.includes(String(subscription.id || ''))
    ) {
      user.billingLastSyncedAt = new Date();
      await user.save();
      return;
    }

    user.stripeSubscriptionId = null;
    user.stripeWorkspaceSubscriptionId = null;
    user.workspacePlan = 'free';
    user.workspacePlanStatus = 'canceled';
    user.plan = 'free';
    user.planStatus = 'canceled';
    user.cancelAtPeriodEnd = false;
    user.currentPeriodStart = currentPeriodStart || user.currentPeriodStart;
    user.currentPeriodEnd = currentPeriodEnd || user.currentPeriodEnd;
    user.workspaceCurrentPeriodStart = user.currentPeriodStart;
    user.workspaceCurrentPeriodEnd = user.currentPeriodEnd;
    user.workspacePaymentGraceUntil = null;
  }
  clearBillingAttention(user);
  user.billingLastSyncedAt = new Date();

  await user.save();
}

async function handleInvoicePaid(invoice) {
  if (!['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) {
    return;
  }

  const subscriptionId = getInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (isPrivateFeedSubscription(subscription)) {
    await syncPrivateFeedEntitlementFromSubscription(subscription, {
      lastStripeEventType: 'invoice.paid',
    });
    return;
  }

  const user = await findUserForSubscription(subscription);

  if (!user) {
    return;
  }

  const billingSelection = findBillingSelectionFromSubscription(subscription);
  if (!isCurrentBillingSubscription(user, subscription, billingSelection)) {
    user.billingLastSyncedAt = new Date();
    await user.save();
    return;
  }

  await applySubscriptionToUser(user, subscription, { billingSelection });
  await sendPaymentSuccessEmailIfNeeded({
    user,
    invoice,
    subscription,
    plan: getPaymentEmailPlan(billingSelection),
  });
}

async function findInvoiceUser(invoice, subscriptionId) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  let user = null;
  if (customerId) {
    user = await User.findOne({ stripeCustomerId: customerId });
  }

  if (!user && subscriptionId) {
    user = await User.findOne({
      $or: [
        { stripeSubscriptionId: subscriptionId },
        { stripeWorkspaceSubscriptionId: subscriptionId },
        { stripeHostingSubscriptionId: subscriptionId },
      ],
    });
  }

  return user;
}

async function retrieveInvoiceSubscription(subscriptionId) {
  if (!subscriptionId) {
    return null;
  }

  try {
    const stripe = getStripeClient();
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (_error) {
    return null;
  }
}

function inferInvoiceBillingSelection(user, subscription, subscriptionId) {
  if (subscription) {
    return findBillingSelectionFromSubscription(subscription);
  }

  if (
    subscriptionId
    && String(user.stripeHostingSubscriptionId || '') === String(subscriptionId)
  ) {
    return {
      productType: 'hosting',
      plan: String(user.hostingPlan || 'none'),
      legacyPlan: 'free',
    };
  }

  return {
    productType: 'workspace',
    plan: String(user.workspacePlan || 'free'),
    legacyPlan: String(user.plan || 'free'),
  };
}

async function handleInvoicePaymentIssue(invoice, {
  eventType = 'invoice.payment_failed',
  reason = 'payment_failed',
} = {}) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const subscription = await retrieveInvoiceSubscription(subscriptionId);

  if (subscription && isPrivateFeedSubscription(subscription)) {
    await syncPrivateFeedEntitlementFromSubscription(subscription, {
      entitlementStatus: 'past_due',
      lastStripeEventType: eventType,
    });
    return;
  }

  const user = await findInvoiceUser(invoice, subscriptionId)
    || (subscription ? await findUserForSubscription(subscription) : null);
  if (!user) {
    return;
  }

  const billingSelection = inferInvoiceBillingSelection(user, subscription, subscriptionId);
  if (
    subscription
    && !isCurrentBillingSubscription(user, subscription, billingSelection)
  ) {
    user.billingLastSyncedAt = new Date();
    await user.save();
    return;
  }

  await sendPaymentFailedEmailIfNeeded({
    user,
    invoice,
    plan: getPaymentEmailPlan(billingSelection),
  });

  setBillingAttention(user, invoice, reason);
  if (billingSelection.productType === 'hosting') {
    if (billingSelection.plan && billingSelection.plan !== 'none') {
      user.hostingPlan = billingSelection.plan;
    }
    user.hostingPlanStatus = 'past_due';
    user.hostingPaymentGraceUntil = getPaymentGraceUntil(user.hostingPaymentGraceUntil);
  } else {
    if (billingSelection.plan && billingSelection.plan !== 'free') {
      user.workspacePlan = billingSelection.plan;
    }
    if (billingSelection.legacyPlan && billingSelection.legacyPlan !== 'free') {
      user.plan = billingSelection.legacyPlan;
    }
    user.planStatus = 'past_due';
    user.workspacePlanStatus = 'past_due';
    user.workspacePaymentGraceUntil = getPaymentGraceUntil(user.workspacePaymentGraceUntil);
  }
  user.billingLastSyncedAt = new Date();

  await user.save();
}

async function handleInvoicePaymentFailed(invoice) {
  return handleInvoicePaymentIssue(invoice);
}

async function handleInvoicePaymentActionRequired(invoice) {
  return handleInvoicePaymentIssue(invoice, {
    eventType: 'invoice.payment_action_required',
    reason: 'payment_action_required',
  });
}

async function handleInvoiceFinalizationFailed(invoice) {
  const subscriptionId = getInvoiceSubscriptionId(invoice);
  const subscription = await retrieveInvoiceSubscription(subscriptionId);

  if (subscription && isPrivateFeedSubscription(subscription)) {
    try {
      await syncPrivateFeedEntitlementFromSubscription(subscription, {
        lastStripeEventType: 'invoice.finalization_failed',
      });
    } catch (_error) {
      // Leave the current entitlement unchanged when Stripe cannot finalize an invoice.
    }
    return;
  }

  const user = await findInvoiceUser(invoice, subscriptionId)
    || (subscription ? await findUserForSubscription(subscription) : null);
  if (!user) {
    return;
  }

  setBillingAttention(user, invoice, 'invoice_finalization_failed');
  user.billingLastSyncedAt = new Date();
  await user.save();
}

async function handleStripeEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(event.data.object);
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return handleSubscriptionCreatedOrUpdated(event.data.object);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(event.data.object);
    case 'invoice.paid':
      return handleInvoicePaid(event.data.object);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(event.data.object);
    case 'invoice.payment_action_required':
      return handleInvoicePaymentActionRequired(event.data.object);
    case 'invoice.finalization_failed':
      return handleInvoiceFinalizationFailed(event.data.object);
    default:
      return null;
  }
}

module.exports = {
  applySubscriptionToUser,
  findBillingSelectionFromCheckoutSession,
  reconcileCheckoutSession,
  syncCheckoutSessionToUser,
  handleStripeEvent,
};
