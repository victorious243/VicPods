const { AppError } = require('../../utils/errors');
const {
  getLegacyPlanForWorkspacePlan,
  getPlanDefinition,
  getPlanStripePriceId,
  normalizeHostingPlan,
  normalizeWorkspacePlan,
} = require('../billing/planCatalog');

function normalizeProductType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'hosting' ? 'hosting' : 'workspace';
}

function normalizePlanInput(value, productType = 'workspace') {
  const normalizedProductType = normalizeProductType(productType);

  if (normalizedProductType === 'hosting') {
    const hostingPlan = normalizeHostingPlan(value);
    return hostingPlan === 'none' ? null : hostingPlan;
  }

  const workspacePlan = normalizeWorkspacePlan(value);
  return workspacePlan === 'free' ? null : workspacePlan;
}

function normalizeBillingSelectionPlan(value, productType = 'workspace') {
  const normalizedProductType = normalizeProductType(productType);
  const normalizedPlan = normalizedProductType === 'hosting'
    ? normalizeHostingPlan(value)
    : normalizeWorkspacePlan(value);

  return {
    productType: normalizedProductType,
    plan: normalizedPlan,
    legacyPlan: normalizedProductType === 'workspace'
      ? getLegacyPlanForWorkspacePlan(normalizedPlan)
      : 'free',
  };
}

function getPriceIdForPlan(plan, productType = 'workspace') {
  const normalizedProductType = normalizeProductType(productType);
  const normalizedPlan = normalizePlanInput(plan, normalizedProductType);

  if (!normalizedPlan) {
    return null;
  }

  return getPlanStripePriceId(getPlanDefinition(normalizedProductType, normalizedPlan));
}

function mapPriceIdToBillingSelection(priceId) {
  if (!priceId) {
    return {
      productType: 'workspace',
      plan: 'free',
      legacyPlan: 'free',
    };
  }

  const allPlans = [
    ...['creator', 'growth', 'studio'].map((plan) => ({
      productType: 'workspace',
      plan,
      legacyPlan: getLegacyPlanForWorkspacePlan(plan),
      priceId: getPriceIdForPlan(plan, 'workspace'),
    })),
    ...['starter', 'growth', 'studio'].map((plan) => ({
      productType: 'hosting',
      plan,
      legacyPlan: 'free',
      priceId: getPriceIdForPlan(plan, 'hosting'),
    })),
  ];
  const matched = allPlans.find((item) => item.priceId && item.priceId === priceId);

  if (matched) {
    return {
      productType: matched.productType,
      plan: matched.plan,
      legacyPlan: matched.legacyPlan,
    };
  }

  return {
    productType: 'workspace',
    plan: 'free',
    legacyPlan: 'free',
  };
}

function mapPriceIdToPlan(priceId) {
  return mapPriceIdToBillingSelection(priceId).legacyPlan;
}

function assertSupportedPlan(plan, productType = 'workspace') {
  const normalizedProductType = normalizeProductType(productType);
  const normalizedPlan = normalizePlanInput(plan, normalizedProductType);

  if (!normalizedPlan) {
    throw new AppError(
      normalizedProductType === 'hosting'
        ? 'Invalid hosting plan selection.'
        : 'Invalid workspace plan selection.',
      400
    );
  }

  const priceId = getPriceIdForPlan(normalizedPlan, normalizedProductType);
  if (!priceId) {
    throw new AppError(`Missing Stripe price for ${normalizedProductType} ${normalizedPlan}.`, 500);
  }

  if (!priceId.startsWith('price_')) {
    throw new AppError(
      `Invalid Stripe price value for ${normalizedProductType} ${normalizedPlan}. Use a Stripe Price ID (price_...).`,
      500
    );
  }

  return {
    productType: normalizedProductType,
    plan: normalizedPlan,
    legacyPlan: normalizedProductType === 'workspace' ? getLegacyPlanForWorkspacePlan(normalizedPlan) : 'free',
    priceId,
  };
}

module.exports = {
  normalizeBillingSelectionPlan,
  normalizePlanInput,
  normalizeProductType,
  getPriceIdForPlan,
  mapPriceIdToBillingSelection,
  mapPriceIdToPlan,
  assertSupportedPlan,
};
