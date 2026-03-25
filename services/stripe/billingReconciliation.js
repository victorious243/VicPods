const User = require('../../models/User');
const { mapPriceIdToPlan } = require('./planMapping');
const { getStripeClient } = require('./stripeClient');
const { applySubscriptionToUser } = require('./webhookHandlers');

const LINKED_SYNC_INTERVAL_MS = 15 * 60 * 1000;
const DISCOVERY_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const ACTIVE_LIKE = new Set(['active', 'trialing']);

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getTimestamp(value) {
  if (!value) {
    return 0;
  }

  return new Date(value).getTime() || 0;
}

function getSyncIntervalMs(user) {
  if (user?.stripeCustomerId || user?.stripeSubscriptionId || user?.plan !== 'free') {
    return LINKED_SYNC_INTERVAL_MS;
  }

  return DISCOVERY_SYNC_INTERVAL_MS;
}

function shouldAttemptBillingRefresh(user, { force = false, now = new Date() } = {}) {
  if (!user || !process.env.STRIPE_SECRET_KEY) {
    return false;
  }

  if (force) {
    return true;
  }

  const lastSyncedAtMs = getTimestamp(user.billingLastSyncedAt);
  if (!lastSyncedAtMs) {
    return true;
  }

  return now.getTime() - lastSyncedAtMs >= getSyncIntervalMs(user);
}

function metadataMatchesUser(metadata, userId) {
  const metadataUserId = String(metadata?.userId || '').trim();
  return !metadataUserId || metadataUserId === userId;
}

function getSubscriptionStatusScore(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (ACTIVE_LIKE.has(normalized)) {
    return 100;
  }

  if (normalized === 'past_due' || normalized === 'unpaid') {
    return 70;
  }

  if (normalized === 'incomplete' || normalized === 'incomplete_expired') {
    return 50;
  }

  if (normalized === 'canceled') {
    return 20;
  }

  return 10;
}

function getSubscriptionPlan(subscription) {
  const priceId = subscription?.items?.data?.[0]?.price?.id;
  return mapPriceIdToPlan(priceId);
}

function buildCandidateScore({ user, customer, subscription }) {
  let score = getSubscriptionStatusScore(subscription.status);
  const userId = user._id.toString();

  if (String(subscription.id || '') === String(user.stripeSubscriptionId || '')) {
    score += 40;
  }

  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  if (String(customerId || '') === String(user.stripeCustomerId || '')) {
    score += 30;
  }

  if (String(subscription.metadata?.userId || '').trim() === userId) {
    score += 60;
  }

  if (String(customer?.metadata?.userId || '').trim() === userId) {
    score += 40;
  }

  if (normalizeEmail(customer?.email) === normalizeEmail(user.email)) {
    score += 15;
  }

  if (getSubscriptionPlan(subscription) !== 'free') {
    score += 10;
  }

  return score;
}

function compareCandidates(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const rightEnd = Number(right.subscription.current_period_end || 0);
  const leftEnd = Number(left.subscription.current_period_end || 0);
  if (rightEnd !== leftEnd) {
    return rightEnd - leftEnd;
  }

  return Number(right.subscription.created || 0) - Number(left.subscription.created || 0);
}

async function collectCustomerCandidates(stripe, user) {
  const byId = new Map();

  if (user.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if (customer && !customer.deleted) {
        byId.set(customer.id, customer);
      }
    } catch (_error) {
      // Ignore missing Stripe customer and continue with discovery by email.
    }
  }

  const email = normalizeEmail(user.email);
  if (email) {
    const customers = await stripe.customers.list({ email, limit: 20 });
    customers.data.forEach((customer) => {
      if (customer && !customer.deleted) {
        byId.set(customer.id, customer);
      }
    });
  }

  return Array.from(byId.values());
}

async function collectSubscriptionCandidates(stripe, user) {
  const candidates = [];
  const seenSubscriptionIds = new Set();
  const userId = user._id.toString();

  if (user.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const customerId = typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id;
      let customer = null;

      if (customerId) {
        try {
          customer = await stripe.customers.retrieve(customerId);
        } catch (_error) {
          customer = null;
        }
      }

      if (
        subscription
        && metadataMatchesUser(subscription.metadata, userId)
        && metadataMatchesUser(customer?.metadata, userId)
      ) {
        candidates.push({
          customer,
          subscription,
        });
        seenSubscriptionIds.add(subscription.id);
      }
    } catch (_error) {
      // Ignore missing Stripe subscription and continue with discovery.
    }
  }

  const customers = await collectCustomerCandidates(stripe, user);
  for (const customer of customers) {
    if (!metadataMatchesUser(customer?.metadata, userId)) {
      continue;
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 20,
    });

    subscriptions.data.forEach((subscription) => {
      if (seenSubscriptionIds.has(subscription.id)) {
        return;
      }

      if (!metadataMatchesUser(subscription.metadata, userId)) {
        return;
      }

      seenSubscriptionIds.add(subscription.id);
      candidates.push({
        customer,
        subscription,
      });
    });
  }

  return candidates;
}

async function findBestSubscriptionCandidate(stripe, user) {
  const candidates = await collectSubscriptionCandidates(stripe, user);
  if (!candidates.length) {
    return null;
  }

  return candidates
    .map((candidate) => ({
      ...candidate,
      score: buildCandidateScore({
        user,
        customer: candidate.customer,
        subscription: candidate.subscription,
      }),
    }))
    .sort(compareCandidates)[0];
}

async function reconcileUserBilling(user, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  if (!shouldAttemptBillingRefresh(user, { ...options, now })) {
    return {
      updated: false,
      skipped: true,
      reason: 'recently_synced',
    };
  }

  const stripe = getStripeClient();
  const candidate = await findBestSubscriptionCandidate(stripe, user);

  if (!candidate) {
    user.billingLastSyncedAt = now;
    await user.save();
    return {
      updated: false,
      skipped: false,
      reason: 'no_matching_subscription',
    };
  }

  user.stripeCustomerId = candidate.customer?.id || user.stripeCustomerId;
  await applySubscriptionToUser(user, candidate.subscription);

  return {
    updated: true,
    skipped: false,
    reason: 'subscription_applied',
    plan: user.plan,
    planStatus: user.planStatus,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
  };
}

async function reconcileAllUsersBilling(options = {}) {
  const filter = {};
  const onlyEmail = normalizeEmail(options.onlyEmail);
  if (onlyEmail) {
    filter.email = onlyEmail;
  }

  const summary = {
    scanned: 0,
    updated: 0,
    skipped: 0,
    noMatch: 0,
    failed: 0,
  };

  const cursor = User.find(filter).cursor();
  for await (const user of cursor) {
    summary.scanned += 1;

    try {
      const result = await reconcileUserBilling(user, { force: true });
      if (result.updated) {
        summary.updated += 1;
      } else if (result.skipped) {
        summary.skipped += 1;
      } else {
        summary.noMatch += 1;
      }
    } catch (_error) {
      summary.failed += 1;
    }
  }

  return summary;
}

module.exports = {
  reconcileUserBilling,
  reconcileAllUsersBilling,
  shouldAttemptBillingRefresh,
};
