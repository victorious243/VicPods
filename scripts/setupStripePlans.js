require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

function requireEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseAmountToCents(rawValue, fallback) {
  const parsed = Number.parseFloat(String(rawValue || '').trim());
  const amount = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return Math.round(amount * 100);
}

function upsertEnvValue(envText, key, value) {
  const escaped = value.replace(/\$/g, '$$$$');
  const linePattern = new RegExp(`^${key}=.*$`, 'm');

  if (linePattern.test(envText)) {
    return envText.replace(linePattern, `${key}=${escaped}`);
  }

  const needsNewline = envText.length > 0 && !envText.endsWith('\n');
  return `${envText}${needsNewline ? '\n' : ''}${key}=${escaped}\n`;
}

async function findOrCreateProduct(stripe, { name, tier }) {
  let startingAfter;

  while (true) {
    const page = await stripe.products.list({
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const found = page.data.find((product) => (
      product.name === name
      || product.metadata?.vicpods_tier === tier
    ));

    if (found) {
      return found;
    }

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1].id;
  }

  return stripe.products.create({
    name,
    metadata: {
      app: 'vicpods',
      vicpods_tier: tier,
    },
  });
}

async function findOrCreateMonthlyPrice(stripe, {
  productId,
  currency,
  unitAmount,
  tier,
}) {
  let startingAfter;

  while (true) {
    const page = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    const found = page.data.find((price) => (
      price.currency === currency
      && price.unit_amount === unitAmount
      && price.type === 'recurring'
      && price.recurring?.interval === 'month'
    ));

    if (found) {
      return found;
    }

    if (!page.has_more || page.data.length === 0) {
      break;
    }

    startingAfter = page.data[page.data.length - 1].id;
  }

  return stripe.prices.create({
    product: productId,
    currency,
    unit_amount: unitAmount,
    recurring: {
      interval: 'month',
    },
    metadata: {
      app: 'vicpods',
      vicpods_tier: tier,
    },
  });
}

async function run() {
  const stripeSecretKey = requireEnv('STRIPE_SECRET_KEY');
  const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

  const currency = String(process.env.STRIPE_BILLING_CURRENCY || 'eur').trim().toLowerCase();
  const proAmountCents = parseAmountToCents(process.env.BILLING_PRICE_PRO, 12.95);
  const premiumAmountCents = parseAmountToCents(process.env.BILLING_PRICE_PREMIUM, 16.95);

  const proProduct = await findOrCreateProduct(stripe, {
    name: 'VicPods Pro',
    tier: 'pro',
  });
  const premiumProduct = await findOrCreateProduct(stripe, {
    name: 'VicPods Premium',
    tier: 'premium',
  });

  const proPrice = await findOrCreateMonthlyPrice(stripe, {
    productId: proProduct.id,
    currency,
    unitAmount: proAmountCents,
    tier: 'pro',
  });
  const premiumPrice = await findOrCreateMonthlyPrice(stripe, {
    productId: premiumProduct.id,
    currency,
    unitAmount: premiumAmountCents,
    tier: 'premium',
  });

  const result = {
    proProductId: proProduct.id,
    premiumProductId: premiumProduct.id,
    proPriceId: proPrice.id,
    premiumPriceId: premiumPrice.id,
    currency,
    proAmount: (proAmountCents / 100).toFixed(2),
    premiumAmount: (premiumAmountCents / 100).toFixed(2),
  };

  if (process.argv.includes('--write-env')) {
    const envPath = path.join(process.cwd(), '.env');
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    let updated = existing;

    updated = upsertEnvValue(updated, 'STRIPE_PRICE_PRO', result.proPriceId);
    updated = upsertEnvValue(updated, 'STRIPE_PRICE_PREMIUM', result.premiumPriceId);
    updated = upsertEnvValue(updated, 'STRIPE_BILLING_CURRENCY', result.currency);
    updated = upsertEnvValue(updated, 'BILLING_PRICE_PRO', result.proAmount);
    updated = upsertEnvValue(updated, 'BILLING_PRICE_PREMIUM', result.premiumAmount);

    fs.writeFileSync(envPath, updated, 'utf8');
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Stripe plan setup failed: ${error.message}`);
  process.exit(1);
});
