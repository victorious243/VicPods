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
  const foundingDeadlineLabel = String(process.env.BILLING_FOUNDING_DEADLINE_LABEL || 'March 31, 2026').trim() || 'March 31, 2026';
  const freeAmount = toNumber(process.env.BILLING_PRICE_FREE, 0);
  const proAmount = toNumber(process.env.BILLING_PRICE_PRO, 19);
  const premiumAmount = toNumber(process.env.BILLING_PRICE_PREMIUM, 39);
  const proStandardAmount = toNumber(process.env.BILLING_PRICE_PRO_STANDARD, 29);
  const premiumStandardAmount = toNumber(process.env.BILLING_PRICE_PREMIUM_STANDARD, 59);

  return {
    currencySymbol,
    intervalLabel,
    foundingDeadlineLabel,
    free: `${currencySymbol}${freeAmount === 0 ? '0' : formatAmount(freeAmount)}`,
    pro: `${currencySymbol}${formatAmount(proAmount)}${intervalLabel}`,
    premium: `${currencySymbol}${formatAmount(premiumAmount)}${intervalLabel}`,
    proStandard: `${currencySymbol}${formatAmount(proStandardAmount)}${intervalLabel}`,
    premiumStandard: `${currencySymbol}${formatAmount(premiumStandardAmount)}${intervalLabel}`,
  };
}

module.exports = {
  getPricingDisplay,
};
