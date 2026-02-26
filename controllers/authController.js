const {
  authenticateUser,
  registerUser,
  resendVerificationPin,
  verifyEmailPin,
} = require('../services/authService');
const {
  isOidcEnabled,
  getOidcStatus,
  buildAuthorizationUrl,
  handleCallback,
} = require('../services/auth/oidcService');
const {
  isGoogleOidcEnabled,
  getGoogleOidcStatus,
  buildGoogleAuthorizationUrl,
  handleGoogleCallback,
} = require('../services/auth/googleOidcService');
const { renderPage } = require('../utils/render');

function getProviderErrorMessage(error, fallbackMessage) {
  const providerMessage = String(
    (error && (error.error_description || error.error || error.message)) || ''
  ).trim();

  if (providerMessage) {
    return providerMessage;
  }

  return fallbackMessage;
}

function establishUserSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        return reject(error);
      }

      req.session.userId = userId;
      return resolve();
    });
  });
}

function showRegister(req, res) {
  const googleOidcStatus = getGoogleOidcStatus();
  return renderPage(res, {
    title: 'Create Account - VicPods',
    pageTitle: 'Create your VicPods account',
    subtitle: 'Start building premium podcast workflows in minutes.',
    view: 'auth/register',
    authPage: true,
    data: {
      googleAuthEnabled: googleOidcStatus.enabled,
      googleAuthMissing: googleOidcStatus.missing,
    },
  });
}

function showTerms(req, res) {
  return renderPage(res, {
    title: 'Terms and Conditions - VicPods',
    pageTitle: 'VicPods Terms and Conditions',
    subtitle: 'Rules, responsibilities, and subscription terms for using VicPods.',
    view: 'auth/terms',
    authPage: true,
    data: {
      authShellClass: 'auth-shell-wide',
    },
  });
}

function showLogin(req, res) {
  const oidcStatus = getOidcStatus();
  const googleOidcStatus = getGoogleOidcStatus();
  return renderPage(res, {
    title: 'Login - VicPods',
    pageTitle: 'Welcome back to VicPods',
    subtitle: 'Sign in to enter your Studio.',
    view: 'auth/login',
    authPage: true,
    data: {
      mojoAuthEnabled: oidcStatus.enabled,
      mojoAuthMissing: oidcStatus.missing,
      googleAuthEnabled: googleOidcStatus.enabled,
      googleAuthMissing: googleOidcStatus.missing,
    },
  });
}

function showVerify(req, res) {
  return renderPage(res, {
    title: 'Verify Email - VicPods',
    pageTitle: 'Verify your email',
    subtitle: 'Enter the 6-digit PIN sent to your email to activate your account.',
    view: 'auth/verify',
    authPage: true,
    data: {
      email: String(req.query.email || '').trim(),
    },
  });
}

async function register(req, res, next) {
  try {
    const result = await registerUser({
      ...req.body,
      acceptedTerms: req.body.acceptTerms === 'on',
      requestIp: req.ip,
    });

    req.flash('success', 'Account created. Enter the PIN sent to your email to activate your account.');
    return res.redirect(`/auth/verify?email=${encodeURIComponent(result.user.email)}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      if (error.statusCode === 409) {
        const email = String(req.body.email || '').trim();
        if (email) {
          return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
        }
      }
      return res.redirect('/auth/register');
    }
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await authenticateUser(req.body);
    await establishUserSession(req, user._id.toString());
    req.flash('success', `Welcome back, ${user.name}.`);
    return res.redirect('/studio');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      if (error.statusCode === 403) {
        const email = String(req.body.email || '').trim();
        if (email) {
          return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
        }
      }
      return res.redirect('/auth/login');
    }
    return next(error);
  }
}

async function verify(req, res, next) {
  try {
    const user = await verifyEmailPin({
      email: req.body.email,
      pin: req.body.pin,
    });

    await establishUserSession(req, user._id.toString());
    req.flash('success', 'Email verified. Welcome to your Studio.');
    return res.redirect('/studio');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      const email = String(req.body.email || '').trim();
      return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
    }

    return next(error);
  }
}

async function resendPin(req, res, next) {
  try {
    const result = await resendVerificationPin({
      email: req.body.email,
    });

    req.flash('success', 'A new verification PIN has been sent.');
    return res.redirect(`/auth/verify?email=${encodeURIComponent(result.user.email)}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      const email = String(req.body.email || '').trim();
      if (email) {
        return res.redirect(`/auth/verify?email=${encodeURIComponent(email)}`);
      }
      return res.redirect('/auth/login');
    }

    return next(error);
  }
}

async function loginWithMojo(req, res, next) {
  try {
    if (!isOidcEnabled()) {
      const oidcStatus = getOidcStatus();
      req.flash('error', `MojoAuth is not configured yet. Missing: ${oidcStatus.missing.join(', ')}`);
      return res.redirect('/auth/login');
    }

    const authorizationUrl = await buildAuthorizationUrl(req);
    return res.redirect(authorizationUrl);
  } catch (error) {
    req.flash('error', error.statusCode ? error.message : 'Unable to start MojoAuth login right now.');
    if (error.statusCode) {
      return res.redirect('/auth/login');
    }
    return next(error);
  }
}

async function mojoCallback(req, res, next) {
  try {
    if (req.query && req.query.error) {
      const providerError = String(req.query.error_description || req.query.error || 'Authentication failed.');
      req.flash('error', providerError);
      return res.redirect('/auth/login');
    }

    const user = await handleCallback(req);
    await establishUserSession(req, user._id.toString());
    req.flash('success', `Welcome, ${user.name}.`);
    return res.redirect('/studio');
  } catch (error) {
    const message = error.statusCode
      ? error.message
      : getProviderErrorMessage(error, 'MojoAuth callback failed. Please try again.');
    req.flash('error', message);
    // eslint-disable-next-line no-console
    console.error(`[MojoAuth Callback Error] ${message}`);
    return res.redirect('/auth/login');
  }
}

async function loginWithGoogle(req, res, next) {
  try {
    if (!isGoogleOidcEnabled()) {
      const googleStatus = getGoogleOidcStatus();
      req.flash('error', `Google auth is not configured yet. Missing: ${googleStatus.missing.join(', ')}`);
      return res.redirect('/auth/login');
    }

    const authorizationUrl = await buildGoogleAuthorizationUrl(req);
    return res.redirect(authorizationUrl);
  } catch (error) {
    req.flash('error', error.statusCode ? error.message : 'Unable to start Google login right now.');
    if (error.statusCode) {
      return res.redirect('/auth/login');
    }
    return next(error);
  }
}

async function googleCallback(req, res, next) {
  try {
    if (req.query && req.query.error) {
      const providerError = String(req.query.error_description || req.query.error || 'Authentication failed.');
      req.flash('error', providerError);
      return res.redirect('/auth/login');
    }

    const user = await handleGoogleCallback(req);
    await establishUserSession(req, user._id.toString());
    req.flash('success', `Welcome, ${user.name}.`);
    return res.redirect('/studio');
  } catch (error) {
    const message = error.statusCode
      ? error.message
      : getProviderErrorMessage(error, 'Google callback failed. Please try again.');
    req.flash('error', message);
    // eslint-disable-next-line no-console
    console.error(`[Google Callback Error] ${message}`);
    return res.redirect('/auth/login');
  }
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie('vicpods.sid');
    return res.redirect('/auth/login');
  });
}

module.exports = {
  showRegister,
  showTerms,
  showLogin,
  showVerify,
  register,
  login,
  verify,
  resendPin,
  loginWithMojo,
  mojoCallback,
  loginWithGoogle,
  googleCallback,
  logout,
};
