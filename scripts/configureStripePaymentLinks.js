require('dotenv').config();

const {
  PAYMENT_LINK_ENV_BY_PLAN,
  isValidStripePaymentLinkUrl,
} = require('../services/stripe/paymentLinks');
const { getStripeClient } = require('../services/stripe/stripeClient');

function normalizeUrl(value) {
  const url = new URL(String(value || '').trim());
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function getConfiguredLinks() {
  return Object.entries(PAYMENT_LINK_ENV_BY_PLAN).flatMap(([productType, plans]) => (
    Object.entries(plans).map(([plan, environmentName]) => ({
      productType,
      plan,
      environmentName,
      url: String(process.env[environmentName] || '').trim(),
    }))
  )).filter((item) => item.url);
}

async function listAllPaymentLinks(stripe) {
  const links = [];
  let startingAfter;

  do {
    const page = await stripe.paymentLinks.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    links.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : null;
  } while (startingAfter);

  return links;
}

async function main() {
  const applyChanges = process.argv.includes('--apply');
  const appUrl = String(process.env.APP_URL || '').trim().replace(/\/$/, '');
  if (!/^https:\/\//i.test(appUrl)) {
    throw new Error('APP_URL must be a production HTTPS URL.');
  }

  const configuredLinks = getConfiguredLinks();
  if (configuredLinks.length !== 6) {
    throw new Error(`Expected all 6 Payment Links, but found ${configuredLinks.length}.`);
  }

  configuredLinks.forEach((item) => {
    if (!isValidStripePaymentLinkUrl(item.url)) {
      throw new Error(`${item.environmentName} is not a valid Stripe Payment Link.`);
    }
  });

  const stripe = getStripeClient();
  const stripeLinks = await listAllPaymentLinks(stripe);
  const matchedLinks = configuredLinks.map((configured) => {
    const normalizedConfiguredUrl = normalizeUrl(configured.url);
    const matches = stripeLinks.filter((link) => normalizeUrl(link.url) === normalizedConfiguredUrl);
    if (matches.length !== 1) {
      throw new Error(
        `${configured.environmentName} matched ${matches.length} active Stripe Payment Links.`
      );
    }

    return {
      ...configured,
      stripeLink: matches[0],
    };
  });

  const redirectUrl = `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  for (const item of matchedLinks) {
    let currentLink = item.stripeLink;
    if (applyChanges) {
      currentLink = await stripe.paymentLinks.update(item.stripeLink.id, {
        after_completion: {
          type: 'redirect',
          redirect: {
            url: redirectUrl,
          },
        },
      });
    }

    const configuredRedirect = currentLink.after_completion?.type === 'redirect'
      ? currentLink.after_completion.redirect?.url
      : '';
    if (configuredRedirect !== redirectUrl) {
      throw new Error(`${item.environmentName} does not have the expected success redirect.`);
    }

    // Do not print configured Payment Link URLs or Stripe credentials.
    console.log(
      `Verified ${item.productType}/${item.plan}`
      + ` (${item.stripeLink.id}) -> ${redirectUrl}`
    );
  }

  if (!applyChanges) {
    console.log('Verification only; no Stripe settings were changed.');
  }
}

main().catch((error) => {
  console.error(`Stripe Payment Link configuration failed: ${error.message}`);
  process.exitCode = 1;
});
