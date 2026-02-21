const { AppError } = require('../utils/errors');

const FREE_DAILY_LIMIT = 5;

function isSameUtcDay(dateA, dateB) {
  return (
    dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate()
  );
}

async function consumeAiCredit(user) {
  if (!user) {
    throw new AppError('Authentication required.', 401);
  }

  if (user.plan !== 'free') {
    return;
  }

  const now = new Date();
  const lastReset = user.aiDailyResetDate ? new Date(user.aiDailyResetDate) : new Date(0);

  if (!isSameUtcDay(now, lastReset)) {
    user.aiDailyCount = 0;
    user.aiDailyResetDate = now;
  }

  if (user.aiDailyCount >= FREE_DAILY_LIMIT) {
    throw new AppError('Free plan limit reached (5 AI generations/day). Upgrade for more.', 429);
  }

  user.aiDailyCount += 1;
  await user.save();
}

module.exports = {
  FREE_DAILY_LIMIT,
  consumeAiCredit,
};
