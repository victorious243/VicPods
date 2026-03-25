const User = require('../../models/User');
const { mapPriceIdToPlan } = require('./planMapping');
const { getStripeClient } = require('./stripeClient');

const ACTIVE_LIKE = new Set(['active', 'trialing']);

function toDate(unixTimestampSeconds) {
  if (!unixTimestampSeconds) {
    return null;
  }

  return new Date(unixTimestampSeconds * 1000);
}

function findPlanFromSubscription(subscription) {
  const items = subscription?.items?.data || [];
  const priceId = items[0]?.price?.id;
  return mapPriceIdToPlan(priceId);
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
  const userId = session.client_reference_id || session.metadata?.userId;

  if (!userId) {
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
    user = await User.findOne({ stripeSubscriptionId: subscriptionId });
  }

  if (!user && subscription.metadata?.userId) {
    user = await User.findById(subscription.metadata.userId);
  }

  return user;
}

async function applySubscriptionToUser(user, subscription) {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  const status = subscription.status || 'canceled';
  const planFromPrice = findPlanFromSubscription(subscription);
  const currentPeriodStart = toDate(subscription.current_period_start);
  const currentPeriodEnd = toDate(subscription.current_period_end);

  const plan = shouldDowngrade({
    plan: planFromPrice,
    status,
    currentPeriodEnd,
  })
    ? 'free'
    : planFromPrice;

  user.stripeCustomerId = customerId || user.stripeCustomerId;
  user.stripeSubscriptionId = subscription.id || user.stripeSubscriptionId;
  user.plan = plan;
  user.planStatus = status;
  user.currentPeriodStart = currentPeriodStart;
  user.currentPeriodEnd = currentPeriodEnd;
  user.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
  user.billingLastSyncedAt = new Date();

  await user.save();
}

async function syncCheckoutSessionToUser(user, session) {
  if (!user || !session || session.mode !== 'subscription') {
    return {
      synced: false,
      reason: 'not_subscription',
    };
  }

  const sessionUserId = String(session.client_reference_id || session.metadata?.userId || '').trim();
  if (sessionUserId && sessionUserId !== user._id.toString()) {
    return {
      synced: false,
      reason: 'user_mismatch',
    };
  }

  user.stripeCustomerId = session.customer || user.stripeCustomerId;
  user.stripeSubscriptionId = session.subscription || user.stripeSubscriptionId;

  if (!session.subscription) {
    await user.save();
    return {
      synced: false,
      reason: 'missing_subscription',
      user,
    };
  }

  const stripe = getStripeClient();
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await applySubscriptionToUser(user, subscription);

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

  const user = await findUserForCheckoutSession(session);

  if (!user) {
    return;
  }

  await syncCheckoutSessionToUser(user, session);
}

async function handleSubscriptionCreatedOrUpdated(subscription) {
  const user = await findUserForSubscription(subscription);

  if (!user) {
    return;
  }

  await applySubscriptionToUser(user, subscription);
}

async function handleSubscriptionDeleted(subscription) {
  const user = await findUserForSubscription(subscription);

  if (!user) {
    return;
  }

  user.stripeCustomerId = user.stripeCustomerId || subscription.customer;
  user.stripeSubscriptionId = null;
  user.plan = 'free';
  user.planStatus = 'canceled';
  user.cancelAtPeriodEnd = false;
  user.currentPeriodStart = toDate(subscription.current_period_start) || user.currentPeriodStart;
  user.currentPeriodEnd = toDate(subscription.current_period_end) || user.currentPeriodEnd;
  user.billingLastSyncedAt = new Date();

  await user.save();
}

async function handleInvoicePaid(invoice) {
  if (!['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason)) {
    return;
  }

  if (!invoice.subscription) {
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  await handleSubscriptionCreatedOrUpdated(subscription);
}

async function handleInvoicePaymentFailed(invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  let user = null;
  if (customerId) {
    user = await User.findOne({ stripeCustomerId: customerId });
  }

  if (!user && invoice.subscription) {
    user = await User.findOne({ stripeSubscriptionId: invoice.subscription });
  }

  if (!user) {
    return;
  }

  user.plan = 'free';
  user.planStatus = 'past_due';
  user.cancelAtPeriodEnd = true;
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
    default:
      return null;
  }
}

module.exports = {
  applySubscriptionToUser,
  reconcileCheckoutSession,
  handleStripeEvent,
};
