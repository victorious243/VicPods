const { getStripeClient } = require('./stripeClient');
const { assertSupportedPlan } = require('./planMapping');

async function createCheckoutSession({ user, plan, appUrl }) {
  const stripe = getStripeClient();
  const { plan: normalizedPlan, priceId } = assertSupportedPlan(plan);

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
      planSelected: normalizedPlan,
    },
    subscription_data: {
      metadata: {
        userId: user._id.toString(),
        planSelected: normalizedPlan,
      },
    },
    allow_promotion_codes: true,
  };

  if (user.stripeCustomerId) {
    payload.customer = user.stripeCustomerId;
  } else {
    payload.customer_email = user.email;
  }

  return stripe.checkout.sessions.create(payload);
}

module.exports = {
  createCheckoutSession,
};
