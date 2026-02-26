const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Issuer, generators } = require('openid-client');
const User = require('../../models/User');
const { AppError } = require('../../utils/errors');

const OIDC_SESSION_KEY = 'oidcFlow';
const SALT_ROUNDS = 12;

let clientPromise = null;

function getConfig() {
  return {
    issuerUrl: String(process.env.MOJOAUTH_ISSUER_URL || '').trim(),
    clientId: String(process.env.MOJOAUTH_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.MOJOAUTH_CLIENT_SECRET || '').trim(),
    redirectUri: String(process.env.MOJOAUTH_REDIRECT_URI || '').trim(),
    scopes: String(process.env.MOJOAUTH_SCOPES || 'openid email profile').trim(),
  };
}

function getOidcStatus() {
  const config = getConfig();
  const missing = [];
  if (!config.issuerUrl) {
    missing.push('MOJOAUTH_ISSUER_URL');
  }
  if (!config.clientId) {
    missing.push('MOJOAUTH_CLIENT_ID');
  }
  if (!config.clientSecret) {
    missing.push('MOJOAUTH_CLIENT_SECRET');
  }
  if (!config.redirectUri) {
    missing.push('MOJOAUTH_REDIRECT_URI');
  }

  return {
    enabled: missing.length === 0,
    missing,
  };
}

function isOidcEnabled() {
  return getOidcStatus().enabled;
}

async function getClient() {
  if (!isOidcEnabled()) {
    throw new AppError('MojoAuth is not configured.', 503);
  }

  if (!clientPromise) {
    const config = getConfig();
    clientPromise = Issuer.discover(config.issuerUrl).then((issuer) => new issuer.Client({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uris: [config.redirectUri],
      response_types: ['code'],
    }));
  }

  return clientPromise;
}

function clearFlowState(req) {
  if (req.session && req.session[OIDC_SESSION_KEY]) {
    delete req.session[OIDC_SESSION_KEY];
  }
}

function extractOidcErrorMessage(error, fallback) {
  const responseBody = error?.response?.body;
  let providerErrorCode = '';

  if (responseBody && typeof responseBody === 'object') {
    providerErrorCode = String(responseBody.error || '').trim();
  } else if (typeof responseBody === 'string') {
    try {
      const parsed = JSON.parse(responseBody);
      providerErrorCode = String(parsed.error || '').trim();
    } catch (_error) {
      // no-op
    }
  }

  const direct = String(error?.error_description || error?.error || error?.message || '').trim();
  if (providerErrorCode && direct) {
    return `${providerErrorCode}: ${direct}`;
  }
  if (providerErrorCode) {
    return providerErrorCode;
  }
  if (direct && direct.toLowerCase() !== 'unauthorized') {
    return direct;
  }

  if (responseBody && typeof responseBody === 'object') {
    const bodyMessage = String(
      responseBody.error_description || responseBody.error || ''
    ).trim();
    if (bodyMessage) {
      return bodyMessage;
    }
  }

  if (typeof responseBody === 'string') {
    try {
      const parsed = JSON.parse(responseBody);
      const parsedMessage = String(parsed.error_description || parsed.error || '').trim();
      if (parsedMessage) {
        return parsedMessage;
      }
    } catch (_error) {
      // no-op
    }
  }

  return direct || fallback;
}

function deriveDisplayName(claims, email) {
  const preferred = String(claims.name || '').trim();
  if (preferred) {
    return preferred.slice(0, 80);
  }

  const first = String(claims.given_name || '').trim();
  const last = String(claims.family_name || '').trim();
  const merged = `${first} ${last}`.trim();
  if (merged) {
    return merged.slice(0, 80);
  }

  return String(email || 'VicPods User')
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .trim()
    .slice(0, 80) || 'VicPods User';
}

async function buildAuthorizationUrl(req) {
  const client = await getClient();
  const config = getConfig();

  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);

  req.session[OIDC_SESSION_KEY] = {
    state,
    nonce,
    codeVerifier,
  };

  return client.authorizationUrl({
    scope: config.scopes,
    redirect_uri: config.redirectUri,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

async function createLocalPasswordPlaceholder() {
  const randomSecret = crypto.randomBytes(32).toString('hex');
  return bcrypt.hash(randomSecret, SALT_ROUNDS);
}

async function upsertUserFromClaims(claims) {
  const email = String(claims.email || '').trim().toLowerCase();
  const subject = String(claims.sub || '').trim();
  const providerSubject = `mojoauth:${subject}`;

  if (!email) {
    throw new AppError('MojoAuth did not return an email address.', 400);
  }

  if (!subject) {
    throw new AppError('MojoAuth did not return a valid subject identifier.', 400);
  }

  const displayName = deriveDisplayName(claims, email);

  let user = await User.findOne({
    $or: [
      { oidcSubject: providerSubject },
      { oidcSubject: subject },
      { email },
    ],
  });

  if (!user) {
    user = await User.create({
      email,
      name: displayName,
      passwordHash: await createLocalPasswordPlaceholder(),
      authProvider: 'mojoauth',
      oidcSubject: providerSubject,
      emailVerified: true,
    });

    return user;
  }

  user.email = email;
  user.name = displayName || user.name;
  user.emailVerified = true;
  user.oidcSubject = providerSubject;
  if (!user.authProvider) {
    user.authProvider = 'mojoauth';
  }

  await user.save();
  return user;
}

async function handleCallback(req) {
  const client = await getClient();
  const config = getConfig();
  const params = client.callbackParams(req);
  const flow = req.session[OIDC_SESSION_KEY];

  if (!flow || !flow.state || !flow.nonce || !flow.codeVerifier) {
    throw new AppError('Login session expired. Please try again.', 400);
  }

  let tokenSet;
  try {
    tokenSet = await client.callback(
      config.redirectUri,
      params,
      {
        state: flow.state,
        nonce: flow.nonce,
        code_verifier: flow.codeVerifier,
      }
    );
  } catch (error) {
    const message = extractOidcErrorMessage(error, 'MojoAuth callback failed.');
    throw new AppError(message, 400);
  } finally {
    clearFlowState(req);
  }

  let claims = tokenSet.claims();
  if (!claims.email && tokenSet.access_token) {
    const userinfo = await client.userinfo(tokenSet.access_token);
    claims = {
      ...userinfo,
      ...claims,
    };
  }

  return upsertUserFromClaims(claims);
}

module.exports = {
  isOidcEnabled,
  getOidcStatus,
  buildAuthorizationUrl,
  handleCallback,
};
