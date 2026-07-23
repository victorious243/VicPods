const crypto = require('crypto');
const { AppError } = require('../../utils/errors');
const {
  normalizeHostingPlan,
  normalizeWorkspacePlan,
} = require('../billing/planCatalog');

const PAYMENT_LINK_ENV_BY_PLAN = {
  workspace: {
    creator: 'STRIPE_PAYMENT_LINK_WORKSPACE_CREATOR',
    growth: 'STRIPE_PAYMENT_LINK_WORKSPACE_GROWTH',
    studio: 'STRIPE_PAYMENT_LINK_WORKSPACE_STUDIO',
  },
  hosting: {
    starter: 'STRIPE_PAYMENT_LINK_HOSTING_STARTER',
    growth: 'STRIPE_PAYMENT_LINK_HOSTING_GROWTH',
    studio: 'STRIPE_PAYMENT_LINK_HOSTING_STUDIO',
  },
};

function normalizePaymentLinkSelection(plan, productType = 'workspace') {
  const normalizedProductType = String(productType || '').trim().toLowerCase() === 'hosting'
    ? 'hosting'
    : 'workspace';
  const normalizedPlan = normalizedProductType === 'hosting'
    ? normalizeHostingPlan(plan)
    : normalizeWorkspacePlan(plan);

  return {
    productType: normalizedProductType,
    plan: normalizedPlan,
  };
}

function getPaymentLinkEnvironmentName(plan, productType = 'workspace') {
  const selection = normalizePaymentLinkSelection(plan, productType);
  return PAYMENT_LINK_ENV_BY_PLAN[selection.productType]?.[selection.plan] || '';
}

function isValidStripePaymentLinkUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:' && parsed.hostname === 'buy.stripe.com' && parsed.pathname !== '/';
  } catch (_error) {
    return false;
  }
}

function getConfiguredPaymentLink(plan, productType = 'workspace') {
  const environmentName = getPaymentLinkEnvironmentName(plan, productType);
  if (!environmentName) {
    return '';
  }

  const configuredUrl = String(process.env[environmentName] || '').trim();
  if (!configuredUrl) {
    return '';
  }

  if (!isValidStripePaymentLinkUrl(configuredUrl)) {
    throw new AppError(`${environmentName} must be a valid https://buy.stripe.com URL.`, 500);
  }

  return configuredUrl;
}

function normalizeClientReferenceId(value) {
  const normalized = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(normalized)) {
    throw new AppError('Unable to create a safe Stripe client reference for this account.', 500);
  }

  return normalized;
}

function getReferenceSigningSecret() {
  return String(process.env.SESSION_SECRET || 'vicpods-payment-link-development-secret').trim();
}

function signClientReferencePayload(payload) {
  return crypto
    .createHmac('sha256', getReferenceSigningSecret())
    .update(payload)
    .digest('hex')
    .slice(0, 24);
}

function buildPaymentLinkClientReferenceId({ userId, productType, plan }) {
  const normalizedUserId = normalizeClientReferenceId(userId);
  const selection = normalizePaymentLinkSelection(plan, productType);
  const payload = [normalizedUserId, selection.productType, selection.plan].join('--');
  return `vp--${payload}--${signClientReferencePayload(payload)}`;
}

function parsePaymentLinkClientReferenceId(value) {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith('vp--')) {
    return null;
  }

  const parts = normalized.split('--');
  if (parts.length !== 5) {
    return null;
  }

  const [, userId, productType, plan, signature] = parts;
  const payload = [userId, productType, plan].join('--');
  const expectedSignature = signClientReferencePayload(payload);
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    suppliedBuffer.length !== expectedBuffer.length
    || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  const selection = normalizePaymentLinkSelection(plan, productType);
  if (selection.productType !== productType || selection.plan !== plan) {
    return null;
  }

  try {
    return {
      userId: normalizeClientReferenceId(userId),
      ...selection,
    };
  } catch (_error) {
    return null;
  }
}

function buildPaymentLinkCheckout({ user, plan, productType = 'workspace' }) {
  const selection = normalizePaymentLinkSelection(plan, productType);
  const configuredUrl = getConfiguredPaymentLink(selection.plan, selection.productType);
  if (!configuredUrl) {
    return null;
  }

  const url = new URL(configuredUrl);
  url.searchParams.set('client_reference_id', buildPaymentLinkClientReferenceId({
    userId: user?._id,
    productType: selection.productType,
    plan: selection.plan,
  }));

  const email = String(user?.email || '').trim().toLowerCase();
  if (email) {
    url.searchParams.set('locked_prefilled_email', email);
  }

  return {
    id: '',
    url: url.toString(),
    source: 'payment_link',
    productType: selection.productType,
    plan: selection.plan,
  };
}

module.exports = {
  PAYMENT_LINK_ENV_BY_PLAN,
  buildPaymentLinkClientReferenceId,
  buildPaymentLinkCheckout,
  getConfiguredPaymentLink,
  getPaymentLinkEnvironmentName,
  isValidStripePaymentLinkUrl,
  normalizePaymentLinkSelection,
  parsePaymentLinkClientReferenceId,
};
