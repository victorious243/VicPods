const { renderPage } = require('../utils/render');
const { createCheckoutSession } = require('../services/stripe/checkout');
const { ensureStripeCustomerForUser, createPortalSession } = require('../services/stripe/portal');

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

function showSuccess(req, res) {
  return renderPage(res, {
    title: 'Billing Success - VicPods',
    pageTitle: 'Payment Received',
    subtitle: 'Processing your subscription. Plan access updates via Stripe webhooks.',
    view: 'billing/success',
    data: {
      checkoutSessionId: req.query.session_id || null,
    },
  });
}

function showCancel(req, res) {
  return renderPage(res, {
    title: 'Billing Canceled - VicPods',
    pageTitle: 'Checkout Canceled',
    subtitle: 'No changes were made to your plan.',
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
