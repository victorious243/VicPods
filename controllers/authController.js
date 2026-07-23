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
const { recordActivityEvent } = require('../services/analytics/appActivityService');
const { getLandingPathFromRequest } = require('../services/analytics/contentAttributionService');
const {
  shouldRequireNewUserMfa,
  issueMfaPin,
  verifyMfaPin,
  resendMfaPin,
  maskEmail,
} = require('../services/auth/mfaService');
const {
  acceptPendingCollaboratorInvitesForUser,
  getCollaboratorInviteByToken,
  normalizeInviteToken,
} = require('../services/team/collaboratorInviteService');
const { AppError } = require('../utils/errors');
const { renderPage } = require('../utils/render');

const AUTH_PAGE_SEO = {
  metaRobots: 'noindex,nofollow',
};

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
  const pendingCollaboratorInviteToken = normalizeInviteToken(req.session?.pendingCollaboratorInviteToken || '');
  user.lastActiveAt = new Date();
  await user.save();

  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        return reject(error);
      }

      req.session.userId = userId;
      if (pendingCollaboratorInviteToken) {
        req.session.pendingCollaboratorInviteToken = pendingCollaboratorInviteToken;
      }
      return resolve();
    });
  });

  const inviteResult = await acceptPendingCollaboratorInvitesForUser(user, {
    inviteToken: pendingCollaboratorInviteToken,
  });

  if (req.session && (inviteResult.acceptedCount > 0 || inviteResult.mismatch)) {
    delete req.session.pendingCollaboratorInviteToken;
  }

  return inviteResult;
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

  const inviteResult = await establishUserSession(req, user);
  req.flash('success', inviteResult.acceptedCount > 0
    ? `${welcomeMessage} ${inviteResult.acceptedCount} collaborator invite${inviteResult.acceptedCount === 1 ? '' : 's'} accepted.`
    : welcomeMessage);
  if (inviteResult.mismatch) {
    req.flash('error', `This collaborator invite is for ${inviteResult.expectedEmail}. Sign in with that email to join ${inviteResult.showName || 'the show'}.`);
  }
  return {
    mfaRequired: false,
    inviteResult,
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
      authShellClass: 'auth-shell-premium',
      googleAuthEnabled: googleOidcStatus.enabled,
      googleAuthMissing: googleOidcStatus.missing,
      pendingReferralCode: res.locals.pendingReferralCode || '',
      pendingTrialInviteCode: res.locals.pendingTrialInviteCode || '',
      ...AUTH_PAGE_SEO,
    },
  });
}

function showTerms(req, res) {
  return res.redirect('/terms');
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
      authShellClass: 'auth-shell-premium',
      googleAuthEnabled: googleOidcStatus.enabled,
      googleAuthMissing: googleOidcStatus.missing,
      ...AUTH_PAGE_SEO,
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
      ...AUTH_PAGE_SEO,
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
      ...AUTH_PAGE_SEO,
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
      ...AUTH_PAGE_SEO,
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
      ...AUTH_PAGE_SEO,
    },
  });
}

async function openCollaboratorInvite(req, res, next) {
  try {
    const inviteToken = normalizeInviteToken(req.params.token);
    const collaboratorInvite = await getCollaboratorInviteByToken(inviteToken);

    if (!collaboratorInvite || !collaboratorInvite.showId) {
      req.flash('error', 'This collaborator invite is invalid or has expired.');
      return res.redirect('/auth/login');
    }

    req.session.pendingCollaboratorInviteToken = inviteToken;

    if (req.currentUser) {
      const inviteResult = await establishUserSession(req, req.currentUser);
      if (inviteResult.acceptedCount > 0) {
        req.flash('success', `You joined ${collaboratorInvite.showId.name}. Your collaborator access is active now.`);
        return res.redirect('/studio/teams');
      }

      if (inviteResult.mismatch) {
        req.flash('error', `This invite is for ${inviteResult.expectedEmail}. Sign in with that email to join ${inviteResult.showName || collaboratorInvite.showId.name}.`);
        return res.redirect('/settings');
      }

      req.flash('success', `Invite loaded for ${collaboratorInvite.email}. Complete sign-in with that email to join ${collaboratorInvite.showId.name}.`);
      return res.redirect('/auth/login');
    }

    req.flash('success', `Invite loaded for ${collaboratorInvite.email}. Sign in or create an account with that email to join ${collaboratorInvite.showId.name}.`);
    return res.redirect('/auth/login');
  } catch (error) {
    return next(error);
  }
}

async function register(req, res, next) {
  try {
    const landingPath = getLandingPathFromRequest(req);
    const result = await registerUser({
      ...req.body,
      acceptedTerms: req.body.acceptTerms === 'on',
      requestIp: req.ip,
      referralCode: req.body.referralCode || req.session?.referralCode || '',
      trialInviteCode: req.body.trialInviteCode || req.session?.trialInviteCode || '',
    });

    let message = 'Check your email and enter the PIN to finish creating your account.';
    if (result.pinDevOnly) {
      message += ` Dev PIN: ${result.pinDevOnly}`;
    }
    await recordActivityEvent(req, {
      eventType: 'signup_started',
      userEmail: result.email || result.user?.email || req.body.email,
      authProvider: 'local',
      metadata: { channel: 'web', landingPath },
    });
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
    await recordActivityEvent(req, {
      eventType: loginResult.mfaRequired ? 'login_mfa_required' : 'login_success',
      user,
      authProvider: user.authProvider,
      metadata: { channel: 'web' },
    });
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
    const landingPath = getLandingPathFromRequest(req);
    const user = await verifyEmailPin({
      email: req.body.email,
      pin: req.body.pin,
    });

    const inviteResult = await establishUserSession(req, user);
    await recordActivityEvent(req, {
      eventType: 'signup_completed',
      user,
      authProvider: user.authProvider,
      metadata: { channel: 'web', landingPath },
    });
    if (req.session) {
      delete req.session.trialInviteCode;
    }
    const hasNoCardTrial = Boolean(
      user.testerTrialInviteId
      && user.planStatus === 'trialing'
      && user.currentPeriodEnd
      && new Date(user.currentPeriodEnd).getTime() > Date.now()
    );
    req.flash(
      'success',
      hasNoCardTrial
        ? `Email verified. Your no-card ${String(user.plan || 'premium').toUpperCase()} trial is live until ${new Date(user.currentPeriodEnd).toLocaleDateString()}.`
        : (inviteResult.acceptedCount > 0
          ? `Email verified. Welcome to your Studio. ${inviteResult.acceptedCount} collaborator invite${inviteResult.acceptedCount === 1 ? '' : 's'} accepted.`
          : 'Email verified. Welcome to your Studio.')
    );
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

    const authResult = await handleGoogleCallback(req);
    const user = authResult.user;
    const hasNoCardTrial = Boolean(
      user.testerTrialInviteId
      && user.planStatus === 'trialing'
      && user.currentPeriodEnd
      && new Date(user.currentPeriodEnd).getTime() > Date.now()
    );
    const welcomeMessage = hasNoCardTrial
      ? `Welcome, ${user.name}. Your no-card ${String(user.plan || 'premium').toUpperCase()} trial is live until ${new Date(user.currentPeriodEnd).toLocaleDateString()}.`
      : `Welcome, ${user.name}.`;
    const loginResult = await finalizeLoginWithMfa(req, user, welcomeMessage);
    if (authResult.isNewUser) {
      await recordActivityEvent(req, {
        eventType: 'signup_completed',
        user,
        authProvider: 'google',
        metadata: { channel: 'web', via: 'google' },
      });
    }
    await recordActivityEvent(req, {
      eventType: loginResult.mfaRequired ? 'login_mfa_required' : 'login_success',
      user,
      authProvider: 'google',
      metadata: { channel: 'web', via: 'google' },
    });
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

    const inviteResult = await establishUserSession(req, user);
    await recordActivityEvent(req, {
      eventType: 'login_success',
      user,
      authProvider: user.authProvider,
      metadata: { channel: 'web', via: 'mfa' },
    });
    req.flash('success', inviteResult.acceptedCount > 0
      ? `Welcome, ${user.name}. ${inviteResult.acceptedCount} collaborator invite${inviteResult.acceptedCount === 1 ? '' : 's'} accepted.`
      : `Welcome, ${user.name}.`);
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

async function logout(req, res, next) {
  await recordActivityEvent(req, {
    eventType: 'logout',
    user: req.currentUser || null,
    authProvider: req.currentUser?.authProvider,
    metadata: { channel: 'web' },
  });

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
  openCollaboratorInvite,
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
