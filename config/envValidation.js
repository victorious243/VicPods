function isValidHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function isValidStripePaymentLinkUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' && parsed.hostname === 'buy.stripe.com' && parsed.pathname !== '/';
  } catch (_error) {
    return false;
  }
}

function extractEmailAddress(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/<([^>]+)>/);
  return String(match ? match[1] : normalized).trim().toLowerCase();
}

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidGoogleOidcClientId(value) {
  return /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(String(value || '').trim());
}

function usesPlaceholderEmailDomain(value) {
  const normalized = extractEmailAddress(value);
  const domain = normalized.split('@')[1] || '';
  return ['yourdomain.com', 'example.com', 'example.org', 'example.net'].includes(domain);
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
  const stripeCheckoutPlans = [
    {
      label: 'workspace Creator',
      price: String(process.env.STRIPE_PRICE_WORKSPACE_CREATOR || stripePricePro).trim(),
      paymentLink: String(process.env.STRIPE_PAYMENT_LINK_WORKSPACE_CREATOR || '').trim(),
    },
    {
      label: 'workspace Growth',
      price: String(process.env.STRIPE_PRICE_WORKSPACE_GROWTH || stripePricePremium).trim(),
      paymentLink: String(process.env.STRIPE_PAYMENT_LINK_WORKSPACE_GROWTH || '').trim(),
    },
    {
      label: 'workspace Studio',
      price: String(process.env.STRIPE_PRICE_WORKSPACE_STUDIO || '').trim(),
      paymentLink: String(process.env.STRIPE_PAYMENT_LINK_WORKSPACE_STUDIO || '').trim(),
    },
    {
      label: 'hosting Starter',
      price: String(process.env.STRIPE_PRICE_HOSTING_STARTER || '').trim(),
      paymentLink: String(process.env.STRIPE_PAYMENT_LINK_HOSTING_STARTER || '').trim(),
    },
    {
      label: 'hosting Growth',
      price: String(process.env.STRIPE_PRICE_HOSTING_GROWTH || '').trim(),
      paymentLink: String(process.env.STRIPE_PAYMENT_LINK_HOSTING_GROWTH || '').trim(),
    },
    {
      label: 'hosting Studio',
      price: String(process.env.STRIPE_PRICE_HOSTING_STUDIO || '').trim(),
      paymentLink: String(process.env.STRIPE_PAYMENT_LINK_HOSTING_STUDIO || '').trim(),
    },
  ];
  const stripePaymentLinks = [
    'STRIPE_PAYMENT_LINK_WORKSPACE_CREATOR',
    'STRIPE_PAYMENT_LINK_WORKSPACE_GROWTH',
    'STRIPE_PAYMENT_LINK_WORKSPACE_STUDIO',
    'STRIPE_PAYMENT_LINK_HOSTING_STARTER',
    'STRIPE_PAYMENT_LINK_HOSTING_GROWTH',
    'STRIPE_PAYMENT_LINK_HOSTING_STUDIO',
  ].map((name) => ({
    name,
    value: String(process.env[name] || '').trim(),
  }));
  const newUserMfaDaysRaw = String(process.env.NEW_USER_MFA_DAYS || '').trim();
  const billingPaymentGraceDaysRaw = String(process.env.BILLING_PAYMENT_GRACE_DAYS || '').trim();
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpPort = String(process.env.SMTP_PORT || '').trim();
  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  const smtpFrom = String(process.env.SMTP_FROM || '').trim();
  const googleIssuerUrl = String(process.env.GOOGLE_OIDC_ISSUER_URL || '').trim();
  const googleClientId = String(process.env.GOOGLE_OIDC_CLIENT_ID || '').trim();
  const googleClientSecret = String(process.env.GOOGLE_OIDC_CLIENT_SECRET || '').trim();
  const googleRedirectUri = String(process.env.GOOGLE_OIDC_REDIRECT_URI || '').trim();
  const legalEntityName = String(process.env.LEGAL_ENTITY_NAME || '').trim();
  const privacyContactEmail = String(process.env.PRIVACY_CONTACT_EMAIL || '').trim();
  const supportContactEmail = String(process.env.SUPPORT_CONTACT_EMAIL || '').trim();
  const legalContactEmail = String(process.env.LEGAL_CONTACT_EMAIL || '').trim();
  const audioStorageDriver = String(process.env.AUDIO_STORAGE_DRIVER || 'local').trim().toLowerCase();
  const objectStorageEnabled = ['object', 'object_storage', 's3', 'r2'].includes(audioStorageDriver);
  const objectStorageEndpoint = String(process.env.OBJECT_STORAGE_ENDPOINT || process.env.S3_ENDPOINT || process.env.R2_ENDPOINT || '').trim();
  const objectStorageBucket = String(process.env.OBJECT_STORAGE_BUCKET || process.env.S3_BUCKET || process.env.R2_BUCKET || '').trim();
  const objectStorageAccessKey = String(process.env.OBJECT_STORAGE_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || '').trim();
  const objectStorageSecretKey = String(process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || '').trim();

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

  if (newUserMfaDaysRaw) {
    const newUserMfaDays = Number.parseInt(newUserMfaDaysRaw, 10);
    if (!Number.isInteger(newUserMfaDays) || newUserMfaDays < 1 || newUserMfaDays > 180) {
      errors.push('NEW_USER_MFA_DAYS must be an integer between 1 and 180.');
    }
  }

  if (billingPaymentGraceDaysRaw) {
    const billingPaymentGraceDays = Number.parseInt(billingPaymentGraceDaysRaw, 10);
    if (
      !Number.isInteger(billingPaymentGraceDays)
      || billingPaymentGraceDays < 0
      || billingPaymentGraceDays > 30
    ) {
      errors.push('BILLING_PAYMENT_GRACE_DAYS must be an integer between 0 and 30.');
    }
  }

  const stripeEnabled = Boolean(
    stripeSecret
    || stripePublic
    || stripePricePro
    || stripePricePremium
    || stripeWebhookSecret
    || stripeCheckoutPlans.some((plan) => plan.price)
    || stripePaymentLinks.some((item) => item.value)
  );
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
    stripeCheckoutPlans.forEach((plan) => {
      if (!plan.paymentLink && !plan.price.startsWith('price_')) {
        pushStripeIssue(
          `Configure a Stripe Payment Link or valid Stripe Price ID (price_...) for ${plan.label}.`
        );
      }
    });
    if (!stripeWebhookSecret) {
      pushStripeIssue('STRIPE_WEBHOOK_SECRET is missing; Stripe webhook sync will not work.');
    }
    stripePaymentLinks
      .filter((item) => item.value && !isValidStripePaymentLinkUrl(item.value))
      .forEach((item) => {
        pushStripeIssue(`${item.name} must be a valid https://buy.stripe.com URL.`);
      });

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

  if (smtpFrom) {
    const smtpFromAddress = extractEmailAddress(smtpFrom);
    const pushSmtpFromIssue = (message) => {
      if (isProduction) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    };

    if (!isValidEmailAddress(smtpFromAddress)) {
      pushSmtpFromIssue('SMTP_FROM must contain a valid sender email address.');
    } else if (usesPlaceholderEmailDomain(smtpFromAddress)) {
      pushSmtpFromIssue('SMTP_FROM uses a placeholder domain. Replace it with a real sender address on a verified domain or inbox delivery may fail.');
    }
  }

  const googleEnabled = Boolean(googleIssuerUrl || googleClientId || googleClientSecret || googleRedirectUri);
  const googleConfigured = Boolean(googleClientId && googleRedirectUri);
  if (googleEnabled && !googleConfigured) {
    warnings.push('Google OIDC is partially configured. Set GOOGLE_OIDC_CLIENT_ID and GOOGLE_OIDC_REDIRECT_URI.');
  }
  if (googleConfigured) {
    if (googleIssuerUrl && !isValidHttpUrl(googleIssuerUrl)) {
      errors.push('GOOGLE_OIDC_ISSUER_URL must be a valid http(s) URL when set.');
    }
    if (!isValidGoogleOidcClientId(googleClientId)) {
      errors.push('GOOGLE_OIDC_CLIENT_ID must be the full Google client ID, including the numeric project prefix and .apps.googleusercontent.com suffix.');
    }
    if (!isValidHttpUrl(googleRedirectUri)) {
      errors.push('GOOGLE_OIDC_REDIRECT_URI must be a valid http(s) URL.');
    }
  }

  if (objectStorageEnabled) {
    const missingObjectStorage = [];
    if (!objectStorageEndpoint) {
      missingObjectStorage.push('OBJECT_STORAGE_ENDPOINT');
    } else if (!isValidHttpUrl(objectStorageEndpoint)) {
      errors.push('OBJECT_STORAGE_ENDPOINT must be a valid http(s) URL when object audio storage is enabled.');
    }
    if (!objectStorageBucket) {
      missingObjectStorage.push('OBJECT_STORAGE_BUCKET');
    }
    if (!objectStorageAccessKey) {
      missingObjectStorage.push('OBJECT_STORAGE_ACCESS_KEY_ID');
    }
    if (!objectStorageSecretKey) {
      missingObjectStorage.push('OBJECT_STORAGE_SECRET_ACCESS_KEY');
    }

    if (missingObjectStorage.length) {
      const message = 'Object audio storage is enabled but missing: ' + missingObjectStorage.join(', ') + '.';
      if (isProduction) {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }
  }

  if (isProduction && !legalEntityName) {
    warnings.push('LEGAL_ENTITY_NAME is not set. Public legal pages will fall back to "VicPods" instead of a formal controller identity.');
  }

  if (isProduction && !privacyContactEmail) {
    warnings.push('PRIVACY_CONTACT_EMAIL is not set. Public legal pages will fall back to a derived domain email where possible.');
  }

  [privacyContactEmail, supportContactEmail, legalContactEmail]
    .filter(Boolean)
    .forEach((emailValue) => {
      if (!isValidEmailAddress(emailValue)) {
        warnings.push(`Legal/support contact email is invalid: ${emailValue}`);
      }
    });

  return { errors, warnings };
}

module.exports = {
  isValidStripePaymentLinkUrl,
  validateEnvironment,
};
