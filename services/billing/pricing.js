const {
  formatPlanPrice,
  getHostingPlanDefinitions,
  getPlanPrice,
  getWorkspacePlanDefinitions,
} = require('./planCatalog');

function toNumber(value, fallback) {
  const parsed = Number.parseFloat(String(value || '').trim());
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }
  return fallback;
}

function formatAmount(amount) {
  return amount.toFixed(2);
}

function getPricingDisplay() {
  const currencySymbol = String(process.env.BILLING_CURRENCY_SYMBOL || '€').trim() || '€';
  const intervalLabel = String(process.env.BILLING_INTERVAL_LABEL || '/mo').trim() || '/mo';
  const freeAmount = toNumber(process.env.BILLING_PRICE_FREE, 0);
  const proAmount = toNumber(process.env.BILLING_PRICE_PRO, 19);
  const premiumAmount = toNumber(process.env.BILLING_PRICE_PREMIUM, 39);
  const proStandardAmount = toNumber(process.env.BILLING_PRICE_PRO_STANDARD, 29);
  const premiumStandardAmount = toNumber(process.env.BILLING_PRICE_PREMIUM_STANDARD, 59);
  const workspacePlans = getWorkspacePlanDefinitions().map((plan) => ({
    ...plan,
    amount: getPlanPrice(plan),
    price: formatPlanPrice(plan, { currencySymbol, intervalLabel }),
  }));
  const hostingPlans = getHostingPlanDefinitions().map((plan) => ({
    ...plan,
    amount: getPlanPrice(plan),
    price: formatPlanPrice(plan, { currencySymbol, intervalLabel }),
  }));

  return {
    currencySymbol,
    intervalLabel,
    free: `${currencySymbol}${freeAmount === 0 ? '0' : formatAmount(freeAmount)}`,
    pro: `${currencySymbol}${formatAmount(proAmount)}${intervalLabel}`,
    premium: `${currencySymbol}${formatAmount(premiumAmount)}${intervalLabel}`,
    proStandard: `${currencySymbol}${formatAmount(proStandardAmount)}${intervalLabel}`,
    premiumStandard: `${currencySymbol}${formatAmount(premiumStandardAmount)}${intervalLabel}`,
    workspacePlans,
    hostingPlans,
  };
}

module.exports = {
  getPricingDisplay,
};
