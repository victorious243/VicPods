const StripeWebhookEvent = require('../models/StripeWebhookEvent');
const { getStripeClient } = require('../services/stripe/stripeClient');
const { handleStripeEvent } = require('../services/stripe/webhookHandlers');

async function handleWebhook(req, res) {
  const signature = req.headers['stripe-signature'];

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Missing STRIPE_WEBHOOK_SECRET');
  }

  if (!signature) {
    return res.status(400).send('Missing Stripe signature');
  }

  let event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    const alreadyProcessed = await StripeWebhookEvent.findOne({ eventId: event.id });
    if (alreadyProcessed) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    await handleStripeEvent(event);

    await StripeWebhookEvent.create({
      eventId: event.id,
      type: event.type,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Stripe webhook handler error:', error.message);
  }

  return res.status(200).json({ received: true });
}

module.exports = {
  handleWebhook,
};
