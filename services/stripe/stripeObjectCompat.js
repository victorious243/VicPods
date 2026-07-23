function toUnixTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function toDate(unixTimestampSeconds) {
  const timestamp = toUnixTimestamp(unixTimestampSeconds);
  return timestamp ? new Date(timestamp * 1000) : null;
}

function getExpandableId(value) {
  if (typeof value === 'string') {
    return value;
  }

  return String(value?.id || '').trim();
}

function getInvoiceSubscriptionId(invoice) {
  const legacySubscriptionId = getExpandableId(invoice?.subscription);
  if (legacySubscriptionId) {
    return legacySubscriptionId;
  }

  if (invoice?.parent?.type !== 'subscription_details') {
    return '';
  }

  return getExpandableId(invoice.parent.subscription_details?.subscription);
}

function getSubscriptionPeriod(subscription) {
  const items = Array.isArray(subscription?.items?.data)
    ? subscription.items.data
    : [];
  const itemStarts = items
    .map((item) => toUnixTimestamp(item?.current_period_start))
    .filter(Boolean);
  const itemEnds = items
    .map((item) => toUnixTimestamp(item?.current_period_end))
    .filter(Boolean);

  const currentPeriodStartUnix = toUnixTimestamp(subscription?.current_period_start)
    || (itemStarts.length ? Math.min(...itemStarts) : 0);
  const currentPeriodEndUnix = toUnixTimestamp(subscription?.current_period_end)
    || (itemEnds.length ? Math.max(...itemEnds) : 0);

  return {
    currentPeriodStartUnix,
    currentPeriodEndUnix,
    currentPeriodStart: toDate(currentPeriodStartUnix),
    currentPeriodEnd: toDate(currentPeriodEndUnix),
  };
}

module.exports = {
  getExpandableId,
  getInvoiceSubscriptionId,
  getSubscriptionPeriod,
  toDate,
  toUnixTimestamp,
};
