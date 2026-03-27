const User = require('../models/User');

const USER_ACTIVITY_TOUCH_MS = 15 * 60 * 1000;

function shouldTouchUserActivity(user, now = new Date()) {
  if (!user) {
    return false;
  }

  if (!user.lastActiveAt) {
    return true;
  }

  return now.getTime() - new Date(user.lastActiveAt).getTime() >= USER_ACTIVITY_TOUCH_MS;
}

async function loadCurrentUser(req, res, next) {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.locals.currentUser = null;
      res.locals.showOnboarding = false;
      return next();
    }

    const user = await User.findById(userId);

    if (!user) {
      req.session.destroy(() => {});
      res.locals.currentUser = null;
      res.locals.showOnboarding = false;
      return next();
    }

    req.currentUser = user;
    res.locals.currentUser = user;

    if (shouldTouchUserActivity(user)) {
      user.lastActiveAt = new Date();
      await user.save();
    }

    res.locals.showOnboarding = Boolean(
      user.emailVerified === true && !user.onboardingCompletedAt
    );
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireSessionUser(req, res, next) {
  if (!req.currentUser) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }

  return next();
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }

  if (req.currentUser.emailVerified === false) {
    req.flash('error', 'Please verify your email before continuing.');
    return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
  }

  return next();
}

function requireGuest(req, res, next) {
  if (req.currentUser) {
    if (req.currentUser.emailVerified === false) {
      return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
    }
    return res.redirect('/studio');
  }

  return next();
}

module.exports = {
  loadCurrentUser,
  requireSessionUser,
  requireAuth,
  requireGuest,
};
