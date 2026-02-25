const { AppError } = require('../../utils/errors');

function normalizePlanInput(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pro' || normalized === 'premium') {
    return normalized;
  }
  return null;
}

function getPriceIdForPlan(plan) {
  const normalizedPlan = normalizePlanInput(plan);

  if (normalizedPlan === 'pro') {
    return String(process.env.STRIPE_PRICE_PRO || '').trim();
  }

  if (normalizedPlan === 'premium') {
    return String(process.env.STRIPE_PRICE_PREMIUM || '').trim();
  }

  return null;
}

function mapPriceIdToPlan(priceId) {
  if (!priceId) {
    return 'free';
  }

  if (priceId === process.env.STRIPE_PRICE_PRO) {
    return 'pro';
  }

  if (priceId === process.env.STRIPE_PRICE_PREMIUM) {
    return 'premium';
  }

  return 'free';
}

function assertSupportedPlan(plan) {
  const normalizedPlan = normalizePlanInput(plan);

  if (!normalizedPlan) {
    throw new AppError('Invalid plan selection. Choose pro or premium.', 400);
  }

  const priceId = getPriceIdForPlan(normalizedPlan);
  if (!priceId) {
    throw new AppError(`Missing Stripe price for ${normalizedPlan}.`, 500);
  }

  if (!priceId.startsWith('price_')) {
    throw new AppError(
      `Invalid STRIPE_PRICE_${normalizedPlan.toUpperCase()} value. Use a Stripe Price ID (price_...).`,
      500
    );
  }

  return {
    plan: normalizedPlan,
    priceId,
  };
}

module.exports = {
  normalizePlanInput,
  getPriceIdForPlan,
  mapPriceIdToPlan,
  assertSupportedPlan,
};
