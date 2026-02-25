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
  const proAmount = toNumber(process.env.BILLING_PRICE_PRO, 12.95);
  const premiumAmount = toNumber(process.env.BILLING_PRICE_PREMIUM, 16.95);

  return {
    currencySymbol,
    intervalLabel,
    free: `${currencySymbol}${freeAmount === 0 ? '0' : formatAmount(freeAmount)}`,
    pro: `${currencySymbol}${formatAmount(proAmount)}${intervalLabel}`,
    premium: `${currencySymbol}${formatAmount(premiumAmount)}${intervalLabel}`,
  };
}

module.exports = {
  getPricingDisplay,
};
