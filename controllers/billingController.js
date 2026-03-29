const { renderPage } = require('../utils/render');
const { createCheckoutSession } = require('../services/stripe/checkout');
const { ensureStripeCustomerForUser, createPortalSession } = require('../services/stripe/portal');
const { getPricingDisplay } = require('../services/billing/pricing');
const { reconcileCheckoutSession } = require('../services/stripe/webhookHandlers');
const { resolveEffectivePlan } = require('../middleware/requirePlan');
const { recordActivityEvent } = require('../services/analytics/appActivityService');

const ACTIVE_BILLING_STATUSES = new Set(['active', 'trialing']);

function formatDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  return new Date(dateValue).toLocaleString();
}

function buildBillingSnapshot(user, effectivePlan) {
  const planStatus = String(user?.planStatus || 'canceled').toLowerCase();
  return {
    effectivePlan,
    storedPlan: String(user?.plan || 'free').toLowerCase(),
    planStatus,
    currentPeriodStartLabel: formatDate(user?.currentPeriodStart),
    currentPeriodEndLabel: formatDate(user?.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(user?.cancelAtPeriodEnd),
    isPaidActive: effectivePlan !== 'free' && ACTIVE_BILLING_STATUSES.has(planStatus),
  };
}

function buildCheckoutSyncViewModel({ sessionId, syncResult, billing }) {
  if (!sessionId) {
    return {
      state: 'pending',
      title: 'Checkout confirmed',
      body: 'We are waiting for Stripe to send the checkout session details.',
      badgeLabel: 'sync pending',
      badgeClass: 'badge-draft',
    };
  }

  if (!syncResult) {
    return {
      state: 'pending',
      title: 'Payment received',
      body: 'Your payment was accepted. We are finalizing plan activation now.',
      badgeLabel: 'sync pending',
      badgeClass: 'badge-draft',
    };
  }

  if (syncResult.error) {
    return {
      state: 'error',
      title: 'Payment received',
      body: 'Your checkout succeeded, but we could not refresh your plan immediately. Open Billing again in a moment or use Manage Billing.',
      badgeLabel: 'needs review',
      badgeClass: 'badge-draft',
    };
  }

  if (billing.isPaidActive) {
    const planLabel = billing.effectivePlan.charAt(0).toUpperCase() + billing.effectivePlan.slice(1);
    return {
      state: 'synced',
      title: `${planLabel} access is live`,
      body: 'Stripe confirmed the subscription and your account is already updated.',
      badgeLabel: billing.planStatus,
      badgeClass: 'badge-ready',
    };
  }

  return {
    state: 'pending',
    title: 'Payment received',
    body: 'Stripe has the payment. Billing access is still syncing and should update shortly.',
    badgeLabel: 'sync pending',
    badgeClass: 'badge-draft',
  };
}

function showBilling(req, res) {
  return res.redirect('/settings?section=billing');
}

async function createCheckout(req, res, next) {
  try {
    const plan = String(req.body.plan || '').toLowerCase();

    const session = await createCheckoutSession({
      user: req.currentUser,
      plan,
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    });

    await recordActivityEvent(req, {
      eventType: 'billing_checkout_started',
      user: req.currentUser,
      statusCode: 302,
      metadata: {
        plan,
        checkoutSessionId: String(session.id || ''),
      },
    });

    return res.redirect(session.url);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/settings?section=billing');
    }

    return next(error);
  }
}

async function openPortal(req, res, next) {
  try {
    const customerId = await ensureStripeCustomerForUser(req.currentUser);

    const session = await createPortalSession({
      customerId,
      appUrl: process.env.APP_URL || 'http://localhost:3000',
    });

    return res.redirect(session.url);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/settings?section=billing');
    }

    return next(error);
  }
}

async function showSuccess(req, res, next) {
  try {
    const checkoutSessionId = String(req.query.session_id || '').trim() || null;
    let syncResult = null;

    if (checkoutSessionId) {
      try {
        syncResult = await reconcileCheckoutSession({
          sessionId: checkoutSessionId,
          user: req.currentUser,
        });
      } catch (error) {
        syncResult = {
          error,
        };
      }
    }

    const effectivePlan = resolveEffectivePlan(req.currentUser);
    req.effectivePlan = effectivePlan;
    res.locals.effectivePlan = effectivePlan;
    res.locals.currentUser = req.currentUser;

    const billing = buildBillingSnapshot(req.currentUser, effectivePlan);
    const checkoutSync = buildCheckoutSyncViewModel({
      sessionId: checkoutSessionId,
      syncResult,
      billing,
    });

    if (checkoutSessionId) {
      await recordActivityEvent(req, {
        eventType: 'billing_checkout_completed',
        user: req.currentUser,
        statusCode: 200,
        metadata: {
          sessionId: checkoutSessionId,
          effectivePlan: billing.effectivePlan,
          planStatus: billing.planStatus,
          syncState: checkoutSync.state,
        },
      });
    }

    return renderPage(res, {
      title: req.t('page.billing.success.title', 'Billing Success - VicPods'),
      pageTitle: req.t('page.billing.success.header', 'Payment Received'),
      subtitle: req.t('page.billing.success.subtitle', 'Your checkout is complete. We are confirming account access and billing details now.'),
      view: 'billing/success',
      data: {
        checkoutSessionId,
        checkoutSync,
        billing,
        pricing: getPricingDisplay(),
      },
    });
  } catch (error) {
    return next(error);
  }
}

function showCancel(req, res) {
  return renderPage(res, {
    title: req.t('page.billing.cancel.title', 'Billing Canceled - VicPods'),
    pageTitle: req.t('page.billing.cancel.header', 'Checkout Canceled'),
    subtitle: req.t('page.billing.cancel.subtitle', 'No changes were made to your plan.'),
    view: 'billing/cancel',
  });
}

module.exports = {
  showBilling,
  createCheckout,
  openPortal,
  showSuccess,
  showCancel,
};
