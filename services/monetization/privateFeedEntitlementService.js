const PodcastShow = require('../../models/PodcastShow');
const PrivateFeedToken = require('../../models/PrivateFeedToken');
const { getStripeClient } = require('../stripe/stripeClient');
const { getSubscriptionPeriod } = require('../stripe/stripeObjectCompat');

const PRIVATE_FEED_FLOW_TYPE = 'private_feed_subscription';
const ACTIVE_ENTITLEMENT_STATUSES = new Set(['active', 'trialing']);
const PRIVATE_FEED_GRACE_PERIOD_DAYS = 7;
const DEFAULT_PLATFORM_FEE_BPS = 1000;

function compactText(value, maxLength = 500) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeEmail(value) {
  return compactText(value, 200).toLowerCase();
}

function toInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isPrivateFeedCheckoutSession(session) {
  return session?.mode === 'subscription' && session?.metadata?.flowType === PRIVATE_FEED_FLOW_TYPE;
}

function isPrivateFeedSubscription(subscription) {
  return subscription?.metadata?.flowType === PRIVATE_FEED_FLOW_TYPE;
}

function privateFeedPayoutsReady() {
  return String(process.env.STRIPE_CONNECT_PRIVATE_FEEDS_ENABLED || '').trim().toLowerCase() === 'true';
}

function getPrivateFeedPlatformFeeBps() {
  return clampNumber(
    toInteger(process.env.PRIVATE_FEED_PLATFORM_FEE_BPS, DEFAULT_PLATFORM_FEE_BPS),
    0,
    5000
  );
}

function normalizeEntitlementStatus(value) {
  const normalized = compactText(value, 40).toLowerCase();
  if (['active', 'trialing', 'past_due', 'canceled', 'revoked'].includes(normalized)) {
    return normalized;
  }

  if (['unpaid', 'incomplete', 'paused'].includes(normalized)) {
    return 'past_due';
  }

  if (normalized === 'incomplete_expired') {
    return 'canceled';
  }

  return 'active';
}

function toDate(unixTimestampSeconds) {
  if (!unixTimestampSeconds) {
    return null;
  }

  return new Date(unixTimestampSeconds * 1000);
}

function isPrivateFeedTokenAccessible(token) {
  if (!token || token.status !== 'active') {
    return false;
  }

  if (token.accessType !== 'subscriber_entitlement') {
    return true;
  }

  if (ACTIVE_ENTITLEMENT_STATUSES.has(normalizeEntitlementStatus(token.entitlementStatus))) {
    return true;
  }

  return Boolean(token.expiresAt && token.expiresAt.getTime() > Date.now());
}

function addDays(date, days) {
  return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

function getPrivateFeedGraceUntil({ status, currentPeriodEnd, now = new Date() } = {}) {
  const normalizedStatus = normalizeEntitlementStatus(status);
  if (ACTIVE_ENTITLEMENT_STATUSES.has(normalizedStatus)) {
    return null;
  }

  const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  if (!periodEnd || Number.isNaN(periodEnd.getTime())) {
    return null;
  }

  if (periodEnd.getTime() > now.getTime()) {
    return periodEnd;
  }

  return normalizedStatus === 'past_due'
    ? addDays(periodEnd, PRIVATE_FEED_GRACE_PERIOD_DAYS)
    : periodEnd;
}

function buildPrivateFeedEntitlementSnapshot(token, { now = new Date() } = {}) {
  const status = normalizeEntitlementStatus(token?.entitlementStatus);
  const currentPeriodEnd = token?.currentPeriodEnd || token?.expiresAt || null;

  return {
    accessible: isPrivateFeedTokenAccessible(token),
    status,
    statusLabel: status.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
    subscriberEmail: token?.subscriberEmail || '',
    currentPeriodEnd,
    graceUntil: getPrivateFeedGraceUntil({ status, currentPeriodEnd, now }),
    stripeSubscriptionId: token?.stripeSubscriptionId || '',
    stripePriceId: token?.stripePriceId || '',
  };
}

function estimatePrivateFeedRevenue({
  subscriberCount = 0,
  priceAmountCents = 0,
  platformFeeBps = getPrivateFeedPlatformFeeBps(),
} = {}) {
  const subscribers = Math.max(0, toInteger(subscriberCount, 0));
  const price = Math.max(0, toInteger(priceAmountCents, 0));
  const feeBps = clampNumber(toInteger(platformFeeBps, DEFAULT_PLATFORM_FEE_BPS), 0, 5000);
  const grossCents = subscribers * price;
  const platformFeeCents = Math.round((grossCents * feeBps) / 10000);

  return {
    subscriberCount: subscribers,
    priceAmountCents: price,
    grossCents,
    platformFeeBps: feeBps,
    platformFeeCents,
    creatorNetCents: Math.max(0, grossCents - platformFeeCents),
  };
}

function buildPrivateFeedEntitlementLabel({ listenerName, listenerEmail }) {
  const normalizedName = compactText(listenerName, 120);
  const normalizedEmail = normalizeEmail(listenerEmail);

  if (normalizedName) {
    return `${normalizedName} premium feed`;
  }

  if (normalizedEmail) {
    return `${normalizedEmail} premium feed`;
  }

  return 'Premium subscriber';
}

async function findSubscriberEntitlementToken({ showId, subscriberEmail }) {
  const normalizedEmail = normalizeEmail(subscriberEmail);
  if (!normalizedEmail) {
    return null;
  }

  return PrivateFeedToken.findOne({
    showId,
    accessType: 'subscriber_entitlement',
    subscriberEmail: normalizedEmail,
  }).sort({ updatedAt: -1, createdAt: -1 });
}

async function findEntitlementTokenForSubscription({ subscriptionId, customerId, showId, subscriberEmail }) {
  const orConditions = [];

  if (subscriptionId) {
    orConditions.push({ stripeSubscriptionId: compactText(subscriptionId, 120) });
  }

  if (customerId && showId) {
    orConditions.push({
      stripeCustomerId: compactText(customerId, 120),
      showId,
    });
  }

  if (showId && subscriberEmail) {
    orConditions.push({
      showId,
      accessType: 'subscriber_entitlement',
      subscriberEmail: normalizeEmail(subscriberEmail),
    });
  }

  if (!orConditions.length) {
    return null;
  }

  return PrivateFeedToken.findOne({
    accessType: 'subscriber_entitlement',
    $or: orConditions,
  }).sort({ updatedAt: -1, createdAt: -1 });
}

async function upsertSubscriberEntitlementToken({
  show,
  listenerEmail,
  listenerName = '',
  stripeCustomerId = '',
  stripeSubscriptionId = '',
  stripePriceId = '',
  checkoutSessionId = '',
  entitlementStatus = 'active',
  currentPeriodStart = null,
  currentPeriodEnd = null,
  canceledAt = null,
  lastStripeEventType = '',
  expiresAt = null,
}) {
  const normalizedEmail = normalizeEmail(listenerEmail);
  if (!show || !normalizedEmail) {
    return null;
  }

  const token = await findEntitlementTokenForSubscription({
    subscriptionId: stripeSubscriptionId,
    customerId: stripeCustomerId,
    showId: show._id,
    subscriberEmail: normalizedEmail,
  }) || new PrivateFeedToken({
    userId: show.userId,
    showId: show._id,
    accessType: 'subscriber_entitlement',
  });

  const nextStatus = normalizeEntitlementStatus(entitlementStatus);

  token.userId = show.userId;
  token.showId = show._id;
  token.accessType = 'subscriber_entitlement';
  token.label = buildPrivateFeedEntitlementLabel({
    listenerName,
    listenerEmail: normalizedEmail,
  });
  token.status = nextStatus === 'revoked' ? 'revoked' : 'active';
  token.subscriberEmail = normalizedEmail;
  token.subscriberName = compactText(listenerName, 120);
  token.stripeCustomerId = compactText(stripeCustomerId, 120);
  token.stripeSubscriptionId = compactText(stripeSubscriptionId, 120);
  token.stripePriceId = compactText(stripePriceId, 120);
  token.checkoutSessionId = compactText(checkoutSessionId, 120);
  token.entitlementStatus = nextStatus;
  token.currentPeriodStart = currentPeriodStart || token.currentPeriodStart || null;
  token.currentPeriodEnd = currentPeriodEnd || expiresAt || token.currentPeriodEnd || null;
  token.canceledAt = canceledAt || null;
  token.lastStripeEventType = compactText(lastStripeEventType, 120);
  token.expiresAt = expiresAt || currentPeriodEnd || null;
  token.lastValidatedAt = new Date();

  await token.save();
  return token;
}

function getPrivateFeedOfferConfig(show) {
  const monetization = show?.monetization || {};
  const payoutsReady = privateFeedPayoutsReady();
  return {
    enabled: Boolean(monetization.privateFeedsEnabled),
    payoutsReady,
    payoutMode: payoutsReady ? 'live' : 'setup_only',
    platformFeeBps: getPrivateFeedPlatformFeeBps(),
    title: compactText(monetization.privateFeedTitle, 120) || 'Private premium feed',
    description: compactText(monetization.privateFeedDescription, 600)
      || 'Unlock the premium feed for private episodes, members-only drops, and subscriber access.',
    priceId: compactText(monetization.privateFeedPriceId, 120),
    ctaLabel: compactText(monetization.privateFeedCtaLabel, 80) || 'Unlock private feed',
  };
}

async function createPrivateFeedCheckoutSession({ show, listenerEmail, listenerName = '', appUrl }) {
  const offer = getPrivateFeedOfferConfig(show);
  const normalizedEmail = normalizeEmail(listenerEmail);
  const normalizedName = compactText(listenerName, 120);

  if (!offer.enabled) {
    throw new Error('Private feeds are not enabled for this show.');
  }

  if (!offer.payoutsReady) {
    throw new Error('Paid private feeds require Stripe Connect payouts before launch.');
  }

  if (!offer.priceId || !offer.priceId.startsWith('price_')) {
    throw new Error('This premium feed is not configured with a Stripe price yet.');
  }

  if (!normalizedEmail) {
    throw new Error('Subscriber email is required.');
  }

  const existingToken = await findSubscriberEntitlementToken({
    showId: show._id,
    subscriberEmail: normalizedEmail,
  });

  if (existingToken && isPrivateFeedTokenAccessible(existingToken)) {
    return {
      alreadyActive: true,
      token: existingToken,
    };
  }

  const stripe = getStripeClient();
  const metadata = {
    flowType: PRIVATE_FEED_FLOW_TYPE,
    showId: show._id.toString(),
    showSlug: show.slug,
    listenerEmail: normalizedEmail,
    listenerName: normalizedName,
  };
  const payload = {
    mode: 'subscription',
    line_items: [
      {
        price: offer.priceId,
        quantity: 1,
      },
    ],
    success_url: `${String(appUrl || '').replace(/\/$/, '')}/podcasts/${encodeURIComponent(show.slug)}/private/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${String(appUrl || '').replace(/\/$/, '')}/podcasts/${encodeURIComponent(show.slug)}`,
    metadata,
    subscription_data: {
      metadata,
    },
    allow_promotion_codes: true,
  };

  if (existingToken?.stripeCustomerId) {
    payload.customer = existingToken.stripeCustomerId;
  } else {
    payload.customer_email = normalizedEmail;
  }

  return {
    alreadyActive: false,
    session: await stripe.checkout.sessions.create(payload),
  };
}

async function syncPrivateFeedEntitlementFromSubscription(subscription, options = {}) {
  if (!subscription) {
    return {
      synced: false,
      reason: 'missing_subscription',
    };
  }

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;
  const metadata = subscription.metadata || {};
  const {
    currentPeriodStart,
    currentPeriodEnd,
  } = getSubscriptionPeriod(subscription);
  const nextStatus = normalizeEntitlementStatus(options.entitlementStatus || subscription.status || 'active');
  const graceUntil = getPrivateFeedGraceUntil({
    status: nextStatus,
    currentPeriodEnd,
  });
  const priceId = subscription.items?.data?.[0]?.price?.id || '';
  let show = options.show || null;

  if (!show && metadata.showId) {
    show = await PodcastShow.findById(metadata.showId);
  }

  let token = await findEntitlementTokenForSubscription({
    subscriptionId: subscription.id,
    customerId,
    showId: show?._id || metadata.showId,
    subscriberEmail: options.listenerEmail || metadata.listenerEmail,
  });

  if (!show && token) {
    show = await PodcastShow.findById(token.showId);
  }

  const listenerEmail = normalizeEmail(options.listenerEmail || metadata.listenerEmail || token?.subscriberEmail);
  const listenerName = compactText(options.listenerName || metadata.listenerName || token?.subscriberName, 120);

  if (!show || !listenerEmail) {
    return {
      synced: false,
      reason: !show ? 'show_not_found' : 'listener_missing',
    };
  }

  token = await upsertSubscriberEntitlementToken({
    show,
    listenerEmail,
    listenerName,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    checkoutSessionId: options.checkoutSessionId,
    entitlementStatus: nextStatus,
    currentPeriodStart,
    currentPeriodEnd,
    canceledAt: toDate(subscription.canceled_at),
    lastStripeEventType: options.lastStripeEventType,
    expiresAt: graceUntil || currentPeriodEnd,
  });

  return {
    synced: Boolean(token),
    reason: token ? 'entitlement_synced' : 'entitlement_missing',
    show,
    token,
    subscription,
  };
}

async function syncPrivateFeedEntitlementFromCheckoutSession(session, options = {}) {
  if (!isPrivateFeedCheckoutSession(session)) {
    return {
      synced: false,
      reason: 'not_private_feed_checkout',
    };
  }

  const stripe = getStripeClient();
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id;
  const subscription = options.subscription || (subscriptionId
    ? await stripe.subscriptions.retrieve(subscriptionId)
    : null);
  const customerEmail = normalizeEmail(
    session.customer_details?.email
      || session.customer_email
      || session.metadata?.listenerEmail
  );
  const customerName = compactText(
    session.customer_details?.name
      || session.metadata?.listenerName,
    120
  );

  if (!subscription) {
    return {
      synced: false,
      reason: 'missing_subscription',
    };
  }

  return syncPrivateFeedEntitlementFromSubscription(subscription, {
    show: options.show,
    listenerEmail: customerEmail,
    listenerName: customerName,
    checkoutSessionId: session.id,
    lastStripeEventType: options.lastStripeEventType || 'checkout.session.completed',
  });
}

module.exports = {
  ACTIVE_ENTITLEMENT_STATUSES,
  PRIVATE_FEED_FLOW_TYPE,
  buildPrivateFeedEntitlementSnapshot,
  createPrivateFeedCheckoutSession,
  estimatePrivateFeedRevenue,
  findSubscriberEntitlementToken,
  getPrivateFeedGraceUntil,
  getPrivateFeedOfferConfig,
  getPrivateFeedPlatformFeeBps,
  isPrivateFeedCheckoutSession,
  isPrivateFeedSubscription,
  isPrivateFeedTokenAccessible,
  privateFeedPayoutsReady,
  syncPrivateFeedEntitlementFromCheckoutSession,
  syncPrivateFeedEntitlementFromSubscription,
  upsertSubscriberEntitlementToken,
};
