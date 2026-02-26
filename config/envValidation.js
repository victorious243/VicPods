function isValidHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function getStripeKeyMode(value, prefix) {
  const normalized = String(value || '').trim();
  if (!normalized.startsWith(prefix)) {
    return 'unknown';
  }
  if (normalized.startsWith(`${prefix}live_`)) {
    return 'live';
  }
  if (normalized.startsWith(`${prefix}test_`)) {
    return 'test';
  }
  return 'unknown';
}

function validateEnvironment({ isProduction }) {
  const errors = [];
  const warnings = [];

  const sessionSecret = String(process.env.SESSION_SECRET || '').trim();
  const mongoUri = String(process.env.MONGO_URI || '').trim();
  const appUrl = String(process.env.APP_URL || '').trim();
  const stripeSecret = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const stripePublic = String(process.env.STRIPE_PUBLIC_KEY || '').trim();
  const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const stripePricePro = String(process.env.STRIPE_PRICE_PRO || '').trim();
  const stripePricePremium = String(process.env.STRIPE_PRICE_PREMIUM || '').trim();
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpPort = String(process.env.SMTP_PORT || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const smtpFrom = String(process.env.SMTP_FROM || '').trim();
  const mojoIssuerUrl = String(process.env.MOJOAUTH_ISSUER_URL || '').trim();
  const mojoClientId = String(process.env.MOJOAUTH_CLIENT_ID || '').trim();
  const mojoClientSecret = String(process.env.MOJOAUTH_CLIENT_SECRET || '').trim();
  const mojoRedirectUri = String(process.env.MOJOAUTH_REDIRECT_URI || '').trim();
  const googleIssuerUrl = String(process.env.GOOGLE_OIDC_ISSUER_URL || '').trim();
  const googleClientId = String(process.env.GOOGLE_OIDC_CLIENT_ID || '').trim();
  const googleClientSecret = String(process.env.GOOGLE_OIDC_CLIENT_SECRET || '').trim();
  const googleRedirectUri = String(process.env.GOOGLE_OIDC_REDIRECT_URI || '').trim();

  if (!mongoUri) {
    errors.push('MONGO_URI is required.');
  }

  if (!sessionSecret) {
    if (isProduction) {
      errors.push('SESSION_SECRET is required in production.');
    } else {
      warnings.push('SESSION_SECRET is not set; using insecure dev fallback secret.');
    }
  }

  if (sessionSecret && sessionSecret.length < 32) {
    if (isProduction) {
      errors.push('SESSION_SECRET must be at least 32 characters in production.');
    } else {
      warnings.push('SESSION_SECRET is shorter than recommended 32 characters.');
    }
  }

  if (!appUrl) {
    errors.push('APP_URL is required.');
  } else if (!isValidHttpUrl(appUrl)) {
    errors.push('APP_URL must be a valid http(s) URL.');
  } else if (isProduction && appUrl.startsWith('http://')) {
    warnings.push('APP_URL uses http:// in production. Prefer https://.');
  }

  const stripeEnabled = Boolean(stripeSecret || stripePublic || stripePricePro || stripePricePremium || stripeWebhookSecret);
  if (stripeEnabled) {
    const pushStripeIssue = (message) => {
      if (isProduction) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    };

    if (!stripeSecret) {
      pushStripeIssue('STRIPE_SECRET_KEY is required when Stripe is enabled.');
    }
    if (!stripePricePro || !stripePricePro.startsWith('price_')) {
      pushStripeIssue('STRIPE_PRICE_PRO must be a valid Stripe Price ID (price_...).');
    }
    if (!stripePricePremium || !stripePricePremium.startsWith('price_')) {
      pushStripeIssue('STRIPE_PRICE_PREMIUM must be a valid Stripe Price ID (price_...).');
    }
    if (!stripeWebhookSecret) {
      pushStripeIssue('STRIPE_WEBHOOK_SECRET is missing; Stripe webhook sync will not work.');
    }

    const secretMode = getStripeKeyMode(stripeSecret, 'sk_');
    const publicMode = getStripeKeyMode(stripePublic, 'pk_');
    if (stripePublic && secretMode !== 'unknown' && publicMode !== 'unknown' && secretMode !== publicMode) {
      warnings.push('Stripe key mode mismatch detected, but STRIPE_PUBLIC_KEY is not used by the current server-side checkout flow.');
    }
  }

  const smtpEnabled = Boolean(smtpHost || smtpPort || smtpUser || smtpPass || smtpFrom);
  const smtpConfigured = Boolean(smtpHost && smtpPort && smtpUser && smtpPass && smtpFrom);
  if (isProduction && !smtpConfigured) {
    errors.push('SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM are required in production for email verification.');
  } else if (smtpEnabled && !smtpConfigured) {
    warnings.push('SMTP is partially configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM for email verification delivery.');
  } else if (!isProduction && !smtpConfigured) {
    warnings.push('SMTP is not configured. Verification emails will not be delivered in local development.');
  }

  const mojoEnabled = Boolean(mojoIssuerUrl || mojoClientId || mojoClientSecret || mojoRedirectUri);
  const mojoConfigured = Boolean(mojoIssuerUrl && mojoClientId && mojoClientSecret && mojoRedirectUri);
  if (mojoEnabled && !mojoConfigured) {
    warnings.push('MojoAuth is partially configured. Set MOJOAUTH_ISSUER_URL, MOJOAUTH_CLIENT_ID, MOJOAUTH_CLIENT_SECRET, and MOJOAUTH_REDIRECT_URI.');
  }
  if (mojoConfigured) {
    if (!isValidHttpUrl(mojoIssuerUrl)) {
      errors.push('MOJOAUTH_ISSUER_URL must be a valid http(s) URL.');
    }
    if (!isValidHttpUrl(mojoRedirectUri)) {
      errors.push('MOJOAUTH_REDIRECT_URI must be a valid http(s) URL.');
    }
  }

  const googleEnabled = Boolean(googleIssuerUrl || googleClientId || googleClientSecret || googleRedirectUri);
  const googleConfigured = Boolean(googleClientId && googleClientSecret && googleRedirectUri);
  if (googleEnabled && !googleConfigured) {
    warnings.push('Google OIDC is partially configured. Set GOOGLE_OIDC_CLIENT_ID, GOOGLE_OIDC_CLIENT_SECRET, and GOOGLE_OIDC_REDIRECT_URI.');
  }
  if (googleConfigured) {
    if (googleIssuerUrl && !isValidHttpUrl(googleIssuerUrl)) {
      errors.push('GOOGLE_OIDC_ISSUER_URL must be a valid http(s) URL when set.');
    }
    if (!isValidHttpUrl(googleRedirectUri)) {
      errors.push('GOOGLE_OIDC_REDIRECT_URI must be a valid http(s) URL.');
    }
  }

  return { errors, warnings };
}

module.exports = {
  validateEnvironment,
};
