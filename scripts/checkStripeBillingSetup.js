require('dotenv').config();

const { getStripeClient } = require('../services/stripe/stripeClient');

const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.payment_action_required',
  'invoice.finalization_failed',
];

function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/^www\./, '');
}

function isVicPodsStripeEndpoint(endpointUrl, appUrl) {
  try {
    const endpoint = new URL(endpointUrl);
    const app = new URL(appUrl);
    return normalizeHostname(endpoint.hostname) === normalizeHostname(app.hostname)
      && endpoint.pathname.replace(/\/$/, '') === '/webhooks/stripe';
  } catch (_error) {
    return false;
  }
}

async function main() {
  const appUrl = String(process.env.APP_URL || '').trim();
  if (!appUrl) {
    throw new Error('APP_URL is missing.');
  }

  const stripe = getStripeClient();
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const matches = endpoints.data.filter((endpoint) => (
    isVicPodsStripeEndpoint(endpoint.url, appUrl)
  ));

  if (matches.length !== 1) {
    throw new Error(`Expected one VicPods Stripe webhook endpoint, but found ${matches.length}.`);
  }

  const endpoint = matches[0];
  if (endpoint.status !== 'enabled') {
    throw new Error(`Stripe webhook ${endpoint.id} is ${endpoint.status}, not enabled.`);
  }

  const enabledEvents = new Set(endpoint.enabled_events || []);
  const missingEvents = enabledEvents.has('*')
    ? []
    : REQUIRED_EVENTS.filter((eventType) => !enabledEvents.has(eventType));
  if (missingEvents.length) {
    throw new Error(`Stripe webhook is missing events: ${missingEvents.join(', ')}`);
  }

  console.log(`Verified enabled webhook ${endpoint.id}: ${endpoint.url}`);
  console.log(`API version: ${endpoint.api_version || 'account default'}`);
  console.log(`Required billing events: ${REQUIRED_EVENTS.length}/${REQUIRED_EVENTS.length}`);
  console.log('The endpoint signing secret can only be proven by a signed test delivery.');
}

main().catch((error) => {
  console.error(`Stripe billing setup check failed: ${error.message}`);
  process.exitCode = 1;
});
