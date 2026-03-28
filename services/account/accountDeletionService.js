const AdminAccessLog = require('../../models/AdminAccessLog');
const AppActivityEvent = require('../../models/AppActivityEvent');
const Episode = require('../../models/Episode');
const Idea = require('../../models/Idea');
const Series = require('../../models/Series');
const Theme = require('../../models/Theme');
const User = require('../../models/User');
const { AppError } = require('../../utils/errors');
const { getStripeClient } = require('../stripe/stripeClient');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isStripeMissingResource(error) {
  return error?.code === 'resource_missing' || error?.statusCode === 404;
}

async function removeStripeAccountData(user) {
  const hasStripeLinks = Boolean(user?.stripeCustomerId || user?.stripeSubscriptionId);

  if (!hasStripeLinks) {
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError(
      'Billing cleanup is unavailable right now. Please contact support before deleting this account.',
      503
    );
  }

  const stripe = getStripeClient();

  if (user.stripeCustomerId) {
    try {
      await stripe.customers.del(user.stripeCustomerId);
      return;
    } catch (error) {
      if (!isStripeMissingResource(error)) {
        throw error;
      }
    }
  }

  if (user.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (error) {
      if (!isStripeMissingResource(error)) {
        throw error;
      }
    }
  }
}

async function deleteAccountForUser(user) {
  const userId = user?._id;
  const userEmail = normalizeEmail(user?.email);
  const referralCode = String(user?.referralCode || '').trim();

  if (!userId) {
    throw new AppError('User account was not found.', 404);
  }

  await removeStripeAccountData(user);

  await Promise.all([
    Episode.deleteMany({ userId }),
    Theme.deleteMany({ userId }),
    Series.deleteMany({ userId }),
    Idea.deleteMany({ userId }),
    AppActivityEvent.deleteMany({
      $or: [
        { userId },
        ...(userEmail ? [{ userEmail }] : []),
      ],
    }),
    AdminAccessLog.deleteMany({
      $or: [
        { userId },
        ...(userEmail ? [{ userEmail }] : []),
      ],
    }),
    User.updateMany(
      {
        $or: [
          { referredByUserId: userId },
          ...(referralCode ? [{ referredByCode: referralCode }] : []),
        ],
      },
      {
        $set: {
          referredByUserId: null,
          referredByCode: '',
        },
      }
    ),
  ]);

  await User.deleteOne({ _id: userId });
}

module.exports = {
  deleteAccountForUser,
};
