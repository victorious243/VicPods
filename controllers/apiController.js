const crypto = require('crypto');

const {
  EMAIL_PIN_TTL_MINUTES,
  PASSWORD_RESET_TTL_MINUTES,
  authenticateUser,
  registerUser,
  requestPasswordReset,
  resetPassword: resetPasswordWithToken,
  resendVerificationPin,
  verifyEmailPin,
} = require('../services/authService');
const {
  getBaseDailyLimitForPlan,
  getDailyLimitForUser,
} = require('../services/limitService');
const { getReferralBonusCredits } = require('../services/marketing/referralService');
const Episode = require('../models/Episode');
const Series = require('../models/Series');
const Theme = require('../models/Theme');

function asErrorMessage(error, fallback = 'Request failed.') {
  if (error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function billingStatusForPlan(user, effectivePlan) {
  if (!user) {
    return 'free';
  }

  if (effectivePlan === 'free') {
    return 'free';
  }

  const status = String(user.planStatus || '').trim().toLowerCase();
  if (status === 'trialing') {
    return 'trialing';
  }
  if (status === 'past_due') {
    return 'pastDue';
  }
  if (status === 'canceled') {
    return 'canceled';
  }
  return 'active';
}

function allowedTranscriptFormatsForPlan(plan) {
  switch (plan) {
    case 'premium':
      return ['txt', 'pdf', 'docx'];
    case 'pro':
      return ['txt', 'pdf'];
    default:
      return ['txt'];
  }
}

function lockedFeaturesForPlan(plan) {
  switch (plan) {
    case 'premium':
      return [];
    case 'pro':
      return ['premiumPersonas', 'toneFix', 'transcriptDOCX'];
    default:
      return ['premiumPersonas', 'continuityRefresh', 'toneFix', 'transcriptPDF', 'transcriptDOCX'];
  }
}

function buildEntitlements(user, effectivePlan) {
  const resolvedPlan = effectivePlan || 'free';
  const baseDailyLimit = getBaseDailyLimitForPlan(resolvedPlan);
  const dailyLimit = getDailyLimitForUser(user, resolvedPlan);
  const referralBonusCredits = getReferralBonusCredits(user);

  return {
    plan: resolvedPlan,
    billingStatus: billingStatusForPlan(user, resolvedPlan),
    allowedTranscriptFormats: allowedTranscriptFormatsForPlan(resolvedPlan),
    lockedFeatures: lockedFeaturesForPlan(resolvedPlan),
    tonePersonasEnabled: resolvedPlan !== 'free',
    aiUsage: {
      used: Number(user?.aiDailyCount || 0),
      limit: Number.isFinite(dailyLimit) ? dailyLimit : null,
      baseLimit: Number.isFinite(baseDailyLimit) ? baseDailyLimit : null,
      bonusCredits: referralBonusCredits,
      resetAt: user?.aiDailyResetDate || null,
    },
    billingPortalURL: null,
  };
}

function buildSecurity(user) {
  return {
    mfaEnabled: Boolean(user?.mfaEnabled),
    mfaMethods: user?.mfaEnabled ? ['email'] : [],
    activeSessionsCount: 1,
  };
}

function buildUserProfile(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    displayName: user.name,
    avatarURL: user.avatarUrl ? user.avatarUrl : null,
    acceptedTermsAt: user.termsAcceptedAt || null,
    authProviders: [user.authProvider === 'google' ? 'google' : 'email'],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function ensureApiAccessToken(req) {
  if (!req.session.apiAccessToken) {
    req.session.apiAccessToken = crypto.randomBytes(24).toString('hex');
  }
  return req.session.apiAccessToken;
}

function buildSessionPayload(req, user, effectivePlan) {
  return {
    accessToken: ensureApiAccessToken(req),
    refreshToken: null,
    user: buildUserProfile(user),
    entitlements: buildEntitlements(user, effectivePlan),
    security: buildSecurity(user),
  };
}

async function establishUserSession(req, user) {
  user.lastActiveAt = new Date();
  await user.save();

  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        return reject(error);
      }

      req.session.userId = user._id.toString();
      req.session.apiAccessToken = crypto.randomBytes(24).toString('hex');
      return resolve();
    });
  });
}

function requireApiUser(req, res) {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function requireVerifiedApiUser(req, res) {
  if (!requireApiUser(req, res)) {
    return false;
  }

  if (req.currentUser.emailVerified === false) {
    res.status(403).json({
      error: 'Please verify your email before continuing.',
      requiresEmailVerification: true,
      email: req.currentUser.email,
    });
    return false;
  }

  return true;
}

function buildVerificationResponse(result) {
  return {
    requiresEmailVerification: true,
    email: result.email || result.user?.email || '',
    verificationExpiresInMinutes: EMAIL_PIN_TTL_MINUTES,
    pinDevOnly: result.pinDevOnly || null,
  };
}

function buildPasswordResetRequestResponse(result) {
  return {
    requested: true,
    email: result.email || '',
    resetLinkExpiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
    resetUrlDevOnly: result.resetUrlDevOnly || null,
  };
}

function episodeMode(episode, series) {
  if (episode.isSingle || series?.creationMode === 'single_collection') {
    return 'single';
  }
  return 'series';
}

function episodeStatus(value) {
  return String(value || 'Planned').trim().toLowerCase();
}

async function register(req, res) {
  try {
    const verificationResult = await registerUser({
      name: req.body?.displayName || req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
      acceptedTerms: Boolean(req.body?.acceptedTerms),
      requestIp: req.ip,
      referralCode: req.body?.referralCode || req.session?.referralCode || '',
    });

    return res.status(202).json({
      result: buildVerificationResponse(verificationResult),
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: asErrorMessage(error, 'Unable to register.'),
    });
  }
}

async function login(req, res) {
  try {
    const user = await authenticateUser({
      email: req.body?.email,
      password: req.body?.password,
    });

    await establishUserSession(req, user);

    return res.json({
      result: {
        session: buildSessionPayload(req, user, req.effectivePlan || user.plan || 'free'),
        mfaChallenge: null,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      error: asErrorMessage(error, 'Invalid login.'),
    });
  }
}

async function verifyRegistration(req, res) {
  try {
    const user = await verifyEmailPin({
      email: req.body?.email,
      pin: req.body?.pin,
    });

    await establishUserSession(req, user);

    return res.json({
      result: {
        session: buildSessionPayload(req, user, req.effectivePlan || user.plan || 'free'),
        mfaChallenge: null,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: asErrorMessage(error, 'Unable to verify email.'),
    });
  }
}

async function forgotPassword(req, res) {
  try {
    const result = await requestPasswordReset({
      email: req.body?.email,
    });

    return res.json({
      result: buildPasswordResetRequestResponse(result),
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: asErrorMessage(error, 'Unable to start password reset.'),
    });
  }
}

async function resetPassword(req, res) {
  try {
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        error: 'New password and confirm password do not match.',
      });
    }

    await resetPasswordWithToken({
      email: req.body?.email,
      token: req.body?.token,
      newPassword,
    });

    return res.json({
      result: {
        passwordReset: true,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: asErrorMessage(error, 'Unable to reset password.'),
    });
  }
}

async function resendRegistrationPin(req, res) {
  try {
    const verificationResult = await resendVerificationPin({
      email: req.body?.email,
    });

    return res.json({
      result: buildVerificationResponse(verificationResult),
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: asErrorMessage(error, 'Unable to resend verification PIN.'),
    });
  }
}

function session(req, res) {
  if (!requireVerifiedApiUser(req, res)) {
    return;
  }

  return res.json({
    session: buildSessionPayload(req, req.currentUser, req.effectivePlan || req.currentUser.plan || 'free'),
  });
}

function logout(req, res, next) {
  req.session.destroy((error) => {
    if (error) {
      return next(error);
    }

    res.clearCookie('vicpods.sid');
    return res.status(204).send();
  });
}

async function studio(req, res, next) {
  if (!requireVerifiedApiUser(req, res)) {
    return;
  }

  try {
    const userId = req.currentUser._id;
    const [seriesCount, themeCount, episodeCount, servedEpisodesCount, recentEpisodes] = await Promise.all([
      Series.countDocuments({ userId }),
      Theme.countDocuments({ userId }),
      Episode.countDocuments({ userId }),
      Episode.countDocuments({ userId, status: 'Served' }),
      Episode.find({ userId })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('seriesId')
        .populate('themeId'),
    ]);

    return res.json({
      dashboard: {
        metrics: {
          seriesCount,
          themeCount,
          episodeCount,
          servedEpisodesCount,
        },
        recentEpisodes: recentEpisodes.map((episode) => ({
          id: episode._id.toString(),
          seriesID: episode.seriesId?._id?.toString() || episode.seriesId?.toString() || '',
          themeID: episode.themeId?._id?.toString() || episode.themeId?.toString() || '',
          title: episode.title || 'Untitled Episode',
          hook: episode.hook || '',
          status: episodeStatus(episode.status),
          mode: episodeMode(episode, episode.seriesId),
          seriesName: episode.seriesId?.name || 'Series',
          themeName: episode.themeId?.name || 'Theme',
          updatedAt: episode.updatedAt,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function markEpisodeShareCopied(req, res, next) {
  if (!requireVerifiedApiUser(req, res)) {
    return;
  }

  try {
    const episode = await Episode.findOne({
      _id: req.params.episodeId,
      userId: req.currentUser._id,
    }).select('_id shareLinkCopiedAt');

    if (!episode) {
      return res.status(404).json({
        error: 'Episode not found.',
      });
    }

    episode.shareLinkCopiedAt = new Date();
    await episode.save();

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  register,
  login,
  verifyRegistration,
  forgotPassword,
  resetPassword,
  resendRegistrationPin,
  session,
  logout,
  studio,
  markEpisodeShareCopied,
};
