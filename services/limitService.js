const { AppError } = require('../utils/errors');
const { sendUsageLimitUpgradeEmailForUser } = require('./email/liveLifecycleEmailService');
const { getReferralBonusCredits } = require('./marketing/referralService');

const FREE_DAILY_LIMIT = 5;
const PRO_DAILY_LIMIT = 50;

function isSameUtcDay(dateA, dateB) {
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

function getDailyLimitForPlan(plan) {
  if (plan === 'premium') {
    return Infinity;
  }

  if (plan === 'pro') {
    return PRO_DAILY_LIMIT;
  }

  return FREE_DAILY_LIMIT;
}

function getBaseDailyLimitForPlan(plan) {
  return getDailyLimitForPlan(plan);
}

function getDailyLimitForUser(user, planOverride) {
  const resolvedPlan = planOverride || user?.plan || 'free';
  const baseLimit = getBaseDailyLimitForPlan(resolvedPlan);

  if (baseLimit === Infinity) {
    return Infinity;
  }

  return baseLimit + getReferralBonusCredits(user);
}

async function consumeAiCredit(user) {
  if (!user) {
    throw new AppError('Authentication required.', 401);
  }

  const plan = user.plan || 'free';
  const planLimit = getDailyLimitForUser(user, plan);

  if (planLimit === Infinity) {
    return;
  }

  const now = new Date();
  const lastReset = user.aiDailyResetDate ? new Date(user.aiDailyResetDate) : new Date(0);

  if (!isSameUtcDay(now, lastReset)) {
    user.aiDailyCount = 0;
    user.aiDailyResetDate = now;
  }

  if (user.aiDailyCount >= planLimit) {
    try {
      await sendUsageLimitUpgradeEmailForUser(user, {
        limitLabel: 'AI generations today',
        usedCount: user.aiDailyCount,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Usage limit email failed for ${user.email}: ${error.message}`);
    }
    throw new AppError(`${plan.charAt(0).toUpperCase() + plan.slice(1)} plan limit reached (${planLimit} generations/day). Upgrade for more.`, 429);
  }

  user.aiDailyCount += 1;
  await user.save();
}

module.exports = {
  FREE_DAILY_LIMIT,
  PRO_DAILY_LIMIT,
  getBaseDailyLimitForPlan,
  getDailyLimitForPlan,
  getDailyLimitForUser,
  consumeAiCredit,
};
