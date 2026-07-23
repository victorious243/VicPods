const User = require('../../models/User');
const { mapPriceIdToBillingSelection, mapPriceIdToPlan } = require('./planMapping');
const { getStripeClient } = require('./stripeClient');
const { getSubscriptionPeriod } = require('./stripeObjectCompat');
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
  if (
    user?.stripeCustomerId
    || user?.stripeSubscriptionId
    || user?.stripeWorkspaceSubscriptionId
    || user?.stripeHostingSubscriptionId
    || user?.plan !== 'free'
    || user?.workspacePlan !== 'free'
    || user?.hostingPlan !== 'none'
  ) {
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

  if (String(subscription.id || '') === String(user.stripeWorkspaceSubscriptionId || '')) {
    score += 40;
  }

  if (String(subscription.id || '') === String(user.stripeHostingSubscriptionId || '')) {
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

  if (mapPriceIdToBillingSelection(subscription?.items?.data?.[0]?.price?.id).productType === 'workspace') {
    score += 5;
  }

  return score;
}

function compareCandidates(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const rightEnd = getSubscriptionPeriod(right.subscription).currentPeriodEndUnix;
  const leftEnd = getSubscriptionPeriod(left.subscription).currentPeriodEndUnix;
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

  const knownSubscriptionIds = [
    user.stripeSubscriptionId,
    user.stripeWorkspaceSubscriptionId,
    user.stripeHostingSubscriptionId,
  ].filter(Boolean);

  for (const knownSubscriptionId of knownSubscriptionIds) {
    try {
      const subscription = await stripe.subscriptions.retrieve(knownSubscriptionId);
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

async function findBestSubscriptionCandidatesByProduct(stripe, user) {
  const candidates = await collectSubscriptionCandidates(stripe, user);
  const grouped = {
    workspace: [],
    hosting: [],
  };

  candidates.forEach((candidate) => {
    const priceId = candidate.subscription?.items?.data?.[0]?.price?.id;
    const billingSelection = mapPriceIdToBillingSelection(priceId);
    const productType = billingSelection.productType || 'workspace';

    grouped[productType].push({
      ...candidate,
      billingSelection,
      score: buildCandidateScore({
        user,
        customer: candidate.customer,
        subscription: candidate.subscription,
      }),
    });
  });

  return {
    workspace: grouped.workspace.sort(compareCandidates)[0] || null,
    hosting: grouped.hosting.sort(compareCandidates)[0] || null,
  };
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
  const candidatesByProduct = await findBestSubscriptionCandidatesByProduct(stripe, user);
  const candidates = [
    candidatesByProduct.workspace,
    candidatesByProduct.hosting,
  ].filter(Boolean);

  if (!candidates.length) {
    user.billingLastSyncedAt = now;
    await user.save();
    return {
      updated: false,
      skipped: false,
      reason: 'no_matching_subscription',
    };
  }

  for (const candidate of candidates) {
    user.stripeCustomerId = candidate.customer?.id || user.stripeCustomerId;
    await applySubscriptionToUser(user, candidate.subscription);
  }

  return {
    updated: true,
    skipped: false,
    reason: candidates.length > 1 ? 'subscriptions_applied' : 'subscription_applied',
    plan: user.plan,
    planStatus: user.planStatus,
    workspacePlan: user.workspacePlan,
    workspacePlanStatus: user.workspacePlanStatus,
    hostingPlan: user.hostingPlan,
    hostingPlanStatus: user.hostingPlanStatus,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    stripeWorkspaceSubscriptionId: user.stripeWorkspaceSubscriptionId,
    stripeHostingSubscriptionId: user.stripeHostingSubscriptionId,
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
  collectSubscriptionCandidates,
  findBestSubscriptionCandidate,
  findBestSubscriptionCandidatesByProduct,
  shouldAttemptBillingRefresh,
};
