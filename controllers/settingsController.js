const bcrypt = require('bcrypt');
const User = require('../models/User');
const { renderPage } = require('../utils/render');
const { AppError } = require('../utils/errors');
const { resolveEffectivePlan } = require('../middleware/requirePlan');

const SALT_ROUNDS = 12;
const VALID_SECTIONS = new Set(['profile', 'appearance', 'security', 'billing']);

function formatDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  return new Date(dateValue).toLocaleString();
}

function statusBadgeClass(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'active' || normalized === 'trialing') {
    return 'badge-ready';
  }

  if (normalized === 'past_due' || normalized === 'unpaid') {
    return 'badge-draft';
  }

  if (normalized === 'canceled') {
    return 'badge-served';
  }

  return 'badge-planned';
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function resolveSection(input) {
  const section = String(input || 'profile').toLowerCase();
  return VALID_SECTIONS.has(section) ? section : 'profile';
}

function normalizeTheme(theme) {
  return theme === 'light' ? 'light' : 'dark';
}

function normalizeAvatarUrl(value) {
  const url = String(value || '').trim();
  if (!url) {
    return '';
  }

  if (/^https?:\/\//i.test(url) || url.startsWith('/')) {
    return url;
  }

  throw new AppError('Avatar URL must start with http://, https://, or /.', 400);
}

function getBillingViewModel(user, effectivePlan) {
  const status = user.planStatus || 'canceled';
  return {
    effectivePlan,
    storedPlan: user.plan,
    planStatus: status,
    planStatusLabel: status.replace(/_/g, ' '),
    currentPeriodStartLabel: formatDate(user.currentPeriodStart),
    currentPeriodEndLabel: formatDate(user.currentPeriodEnd),
    cancelAtPeriodEnd: Boolean(user.cancelAtPeriodEnd),
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    statusBadgeClass: statusBadgeClass(status),
  };
}

function showSettings(req, res) {
  const effectivePlan = req.effectivePlan || resolveEffectivePlan(req.currentUser);
  const selectedSection = resolveSection(req.query.section);

  return renderPage(res, {
    title: 'Settings - VicPods',
    pageTitle: 'Settings',
    subtitle: 'Profile, appearance, security, and billing controls in one place.',
    view: 'settings/index',
    data: {
      effectivePlan,
      selectedSection,
      billing: getBillingViewModel(req.currentUser, effectivePlan),
    },
  });
}

async function updateProfile(req, res, next) {
  try {
    const user = req.currentUser;
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const avatarUrl = normalizeAvatarUrl(req.body.avatarUrl);

    if (!name) {
      throw new AppError('Name is required.', 400);
    }

    if (!email) {
      throw new AppError('Email is required.', 400);
    }

    const emailTaken = await User.findOne({
      _id: { $ne: user._id },
      email,
    }).select('_id');

    if (emailTaken) {
      throw new AppError('That email is already in use by another account.', 409);
    }

    user.name = name;
    user.email = email;
    user.avatarUrl = avatarUrl;
    await user.save();

    req.flash('success', 'Profile updated.');
    return res.redirect('/settings?section=profile');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/settings?section=profile');
    }

    return next(error);
  }
}

async function updateAppearance(req, res, next) {
  try {
    const user = req.currentUser;
    user.themePreference = normalizeTheme(req.body.themePreference);
    await user.save();

    req.flash('success', 'Appearance preference updated.');
    return res.redirect('/settings?section=appearance');
  } catch (error) {
    return next(error);
  }
}

async function updatePassword(req, res, next) {
  try {
    const user = req.currentUser;
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new AppError('Current password, new password, and confirm password are required.', 400);
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters.', 400);
    }

    if (newPassword !== confirmPassword) {
      throw new AppError('New password and confirm password do not match.', 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect.', 401);
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    req.flash('success', 'Password updated successfully.');
    return res.redirect('/settings?section=security');
  } catch (error) {
    if (error.statusCode) {
      req.flash('error', error.message);
      return res.redirect('/settings?section=security');
    }

    return next(error);
  }
}

module.exports = {
  showSettings,
  updateProfile,
  updateAppearance,
  updatePassword,
};
