const { AppError } = require('../../utils/errors');
const { getStripeClient } = require('./stripeClient');

async function ensureStripeCustomerForUser(user) {
  const stripe = getStripeClient();

  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: {
      userId: user._id.toString(),
    },
  });

  user.stripeCustomerId = customer.id;
  await user.save();

  return customer.id;
}

async function createPortalSession({ customerId, appUrl }) {
  if (!customerId) {
    throw new AppError('No Stripe customer found for this account.', 400);
  }

  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/billing`,
  });
}

module.exports = {
  ensureStripeCustomerForUser,
  createPortalSession,
};
