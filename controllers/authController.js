const {
  authenticateUser,
  registerUser,
  requestPasswordReset,
  resetPassword: resetPasswordWithToken,
  resendVerificationPin,
  verifyEmailPin,
} = require('../services/authService');
const {
  isGoogleOidcEnabled,
  getGoogleOidcStatus,
  buildGoogleAuthorizationUrl,
  handleGoogleCallback,
} = require('../services/auth/googleOidcService');
const {
  shouldRequireNewUserMfa,
  issueMfaPin,
  verifyMfaPin,
  resendMfaPin,
  maskEmail,
} = require('../services/auth/mfaService');
const { AppError } = require('../utils/errors');
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

async function establishUserSession(req, user) {
  const userId = user._id.toString();
  user.lastActiveAt = new Date();
  await user.save();

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

function establishPendingMfaSession(req, userId, email) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        return reject(error);
      }

      req.session.pendingMfaUserId = userId;
      req.session.pendingMfaEmail = String(email || '').trim().toLowerCase();
      return resolve();
    });
  });
}

function getPendingMfaUserId(req) {
  return String(req.session?.pendingMfaUserId || '').trim();
}

function clearPendingMfaSession(req) {
  if (req.session) {
    delete req.session.pendingMfaUserId;
    delete req.session.pendingMfaEmail;
  }
}

async function finalizeLoginWithMfa(req, user, welcomeMessage) {
  const userId = user._id.toString();

  if (shouldRequireNewUserMfa(user)) {
    const issueResult = await issueMfaPin(user);
    await establishPendingMfaSession(req, userId, user.email);
    let message = `Security check required. Enter the 6-digit code sent to ${issueResult.maskedEmail}.`;
    if (issueResult.pinDevOnly) {
      message += ` Dev code: ${issueResult.pinDevOnly}`;
    }
    req.flash('success', message);
    return {
      mfaRequired: true,
    };
  }

  await establishUserSession(req, user);
  req.flash('success', welcomeMessage);
  return {
    mfaRequired: false,
  };
}

function showRegister(req, res) {
  const googleOidcStatus = getGoogleOidcStatus();
  return renderPage(res, {
    title: req.t('page.auth.register.title', 'Create Account - VicPods'),
    pageTitle: req.t('page.auth.register.header', 'Create your VicPods account'),
    subtitle: req.t('page.auth.register.subtitle', 'Start building premium podcast workflows in minutes.'),
    view: 'auth/register',
    authPage: true,
    data: {
      googleAuthEnabled: googleOidcStatus.enabled,
      googleAuthMissing: googleOidcStatus.missing,
      pendingReferralCode: res.locals.pendingReferralCode || '',
    },
  });
}

function showTerms(req, res) {
  return renderPage(res, {
    title: req.t('page.auth.terms.title', 'Terms and Conditions - VicPods'),
    pageTitle: req.t('page.auth.terms.header', 'VicPods Terms and Conditions'),
    subtitle: req.t('page.auth.terms.subtitle', 'Rules, responsibilities, and subscription terms for using VicPods.'),
    view: 'auth/terms',
    authPage: true,
    data: {
      authShellClass: 'auth-shell-wide',
    },
  });
}

function showLogin(req, res) {
  const googleOidcStatus = getGoogleOidcStatus();
  return renderPage(res, {
    title: req.t('page.auth.login.title', 'Login - VicPods'),
    pageTitle: req.t('page.auth.login.header', 'Welcome back to VicPods'),
    subtitle: req.t('page.auth.login.subtitle', 'Sign in to enter your Studio.'),
    view: 'auth/login',
    authPage: true,
    data: {
      googleAuthEnabled: googleOidcStatus.enabled,
      googleAuthMissing: googleOidcStatus.missing,
    },
  });
}

function showForgotPassword(req, res) {
  return renderPage(res, {
    title: 'Forgot Password - VicPods',
    pageTitle: 'Reset your password',
    subtitle: 'Enter your account email and we will send a secure reset link.',
    view: 'auth/forgot-password',
    authPage: true,
    data: {
      email: String(req.query.email || '').trim(),
    },
  });
}

function showVerify(req, res) {
  return renderPage(res, {
    title: req.t('page.auth.verify.title', 'Verify Email - VicPods'),
    pageTitle: req.t('page.auth.verify.header', 'Verify your email'),
    subtitle: req.t('page.auth.verify.subtitle', 'Enter the 6-digit PIN sent to your email to activate your account.'),
    view: 'auth/verify',
    authPage: true,
    data: {
      email: String(req.query.email || '').trim(),
    },
  });
}

function showResetPassword(req, res) {
  return renderPage(res, {
    title: 'Reset Password - VicPods',
    pageTitle: 'Choose a new password',
    subtitle: 'Create a new password for your VicPods account.',
    view: 'auth/reset-password',
    authPage: true,
    data: {
      token: String(req.query.token || '').trim(),
    },
  });
}

function showMfa(req, res) {
  const pendingMfaUserId = getPendingMfaUserId(req);
  if (!pendingMfaUserId) {
    clearPendingMfaSession(req);
    req.flash('error', 'Your sign-in security session expired. Please sign in again.');
    return res.redirect('/auth/login');
  }

  return renderPage(res, {
    title: req.t('page.auth.mfa.title', 'Security Check - VicPods'),
    pageTitle: req.t('page.auth.mfa.header', 'Complete sign-in security check'),
    subtitle: req.t('page.auth.mfa.subtitle', 'Enter the 6-digit code we sent to your email.'),
    view: 'auth/mfa',
    authPage: true,
    data: {
      maskedEmail: maskEmail(String(req.session.pendingMfaEmail || req.query.email || '').trim()),
    },
  });
}

async function register(req, res, next) {
  try {
    const result = await registerUser({
      ...req.body,
      acceptedTerms: req.body.acceptTerms === 'on',
      requestIp: req.ip,
      referralCode: req.body.referralCode || req.session?.referralCode || '',
    });

    let message = 'Check your email and enter the PIN to finish creating your account.';
    if (result.pinDevOnly) {
      message += ` Dev PIN: ${result.pinDevOnly}`;
    }
    req.flash('success', message);
    return res.redirect(`/auth/verify?email=${encodeURIComponent(result.email || result.user?.email || req.body.email)}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/auth/register');
    }
    return next(error);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const result = await requestPasswordReset({
      email: req.body.email,
    });

    let message = 'If an account exists for that email, we sent a password reset link.';
    if (result.resetUrlDevOnly) {
      message += ` Dev link: ${result.resetUrlDevOnly}`;
    }
    req.flash('success', message);
    return res.redirect(`/auth/forgot-password?email=${encodeURIComponent(result.email || req.body.email || '')}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect(`/auth/forgot-password?email=${encodeURIComponent(String(req.body.email || '').trim())}`);
    }
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const user = await authenticateUser(req.body);
    const loginResult = await finalizeLoginWithMfa(req, user, `Welcome back, ${user.name}.`);
    if (loginResult.mfaRequired) {
      return res.redirect(`/auth/mfa?email=${encodeURIComponent(user.email)}`);
    }
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

async function resetPassword(req, res, next) {
  try {
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    if (newPassword !== confirmPassword) {
      throw new AppError('New password and confirm password do not match.', 400);
    }

    await resetPasswordWithToken({
      email: req.body.email,
      token: req.body.token,
      newPassword,
    });

    req.flash('success', 'Password reset successful. Sign in with your new password.');
    return res.redirect('/auth/login');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      const token = encodeURIComponent(String(req.body.token || '').trim());
      return res.redirect(`/auth/reset-password?token=${token}`);
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

    await establishUserSession(req, user);
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

    let message = 'A new verification PIN has been sent.';
    if (result.pinDevOnly) {
      message += ` Dev PIN: ${result.pinDevOnly}`;
    }
    req.flash('success', message);
    return res.redirect(`/auth/verify?email=${encodeURIComponent(result.email || result.user?.email || req.body.email)}`);
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
    const loginResult = await finalizeLoginWithMfa(req, user, `Welcome, ${user.name}.`);
    if (loginResult.mfaRequired) {
      return res.redirect(`/auth/mfa?email=${encodeURIComponent(user.email)}`);
    }
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

async function verifyMfa(req, res, next) {
  try {
    const pendingMfaUserId = getPendingMfaUserId(req);
    if (!pendingMfaUserId) {
      clearPendingMfaSession(req);
      req.flash('error', 'Your sign-in security session expired. Please sign in again.');
      return res.redirect('/auth/login');
    }

    const user = await verifyMfaPin({
      userId: pendingMfaUserId,
      pin: req.body.pin,
    });

    await establishUserSession(req, user);
    req.flash('success', `Welcome, ${user.name}.`);
    return res.redirect('/studio');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      if (error.message.includes('expired') || error.message.includes('Please log in again')) {
        clearPendingMfaSession(req);
        return res.redirect('/auth/login');
      }
      return res.redirect('/auth/mfa');
    }
    return next(error);
  }
}

async function resendMfa(req, res, next) {
  try {
    const pendingMfaUserId = getPendingMfaUserId(req);
    const result = await resendMfaPin({
      userId: pendingMfaUserId,
    });

    let message = `A new 6-digit security code was sent to ${result.maskedEmail}.`;
    if (result.pinDevOnly) {
      message += ` Dev code: ${result.pinDevOnly}`;
    }
    req.flash('success', message);
    return res.redirect(`/auth/mfa?email=${encodeURIComponent(result.user.email)}`);
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      if (
        error.message.includes('expired')
        || error.message.includes('not required')
      ) {
        clearPendingMfaSession(req);
        return res.redirect('/auth/login');
      }
      return res.redirect('/auth/mfa');
    }
    return next(error);
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
  showForgotPassword,
  showVerify,
  showResetPassword,
  showMfa,
  register,
  forgotPassword,
  login,
  resetPassword,
  verify,
  resendPin,
  loginWithGoogle,
  googleCallback,
  verifyMfa,
  resendMfa,
  logout,
};
