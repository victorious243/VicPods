const User = require('../models/User');

async function loadCurrentUser(req, res, next) {
  try {
    const userId = req.session.userId;

    if (!userId) {
      res.locals.currentUser = null;
      return next();
    }

    const user = await User.findById(userId);

    if (!user) {
      req.session.destroy(() => {});
      res.locals.currentUser = null;
      return next();
    }

    req.currentUser = user;
    res.locals.currentUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

function requireAuth(req, res, next) {
  if (!req.currentUser) {
    req.flash('error', 'Please log in to continue.');
    return res.redirect('/auth/login');
  }

  return next();
}

function requireGuest(req, res, next) {
  if (req.currentUser) {
    return res.redirect('/studio');
  }

  return next();
}

module.exports = {
  loadCurrentUser,
  requireAuth,
  requireGuest,
};
