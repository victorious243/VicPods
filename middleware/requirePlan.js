const { AppError } = require('../utils/errors');

const planPriority = {
  free: 0,
  pro: 1,
  premium: 2,
};

const ACCESS_STATUSES = new Set(['active', 'trialing']);

function hasActiveSubscription(user, now = new Date()) {
  if (!user) {
    return false;
  }

  if (!ACCESS_STATUSES.has(user.planStatus)) {
    return false;
  }

  if (!user.currentPeriodEnd) {
    return false;
  }

  return new Date(user.currentPeriodEnd).getTime() > now.getTime();
}

function resolveEffectivePlan(user, now = new Date()) {
  if (!user) {
    return 'free';
  }

  if (user.plan === 'free') {
    return 'free';
  }

  return hasActiveSubscription(user, now) ? user.plan : 'free';
}

async function syncPlanStatus(req, res, next) {
  try {
    if (!req.currentUser) {
      res.locals.effectivePlan = 'free';
      return next();
    }

    const now = new Date();
    const effectivePlan = resolveEffectivePlan(req.currentUser, now);
    req.effectivePlan = effectivePlan;
    res.locals.effectivePlan = effectivePlan;

    if (req.currentUser.plan !== effectivePlan) {
      req.currentUser.plan = effectivePlan;

      if (effectivePlan === 'free' && ACCESS_STATUSES.has(req.currentUser.planStatus)) {
        req.currentUser.planStatus = 'canceled';
      }

      if (effectivePlan === 'free') {
        req.currentUser.cancelAtPeriodEnd = false;
      }

      await req.currentUser.save();
      res.locals.currentUser = req.currentUser;
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

function requirePlan(requiredPlan) {
  return (req, res, next) => {
    const currentPlan = req.effectivePlan || resolveEffectivePlan(req.currentUser);

    if (planPriority[currentPlan] >= planPriority[requiredPlan]) {
      return next();
    }

    if (req.accepts('html')) {
      req.flash('error', `This feature requires the ${requiredPlan} plan.`);
      return res.redirect('/settings?section=billing');
    }

    return next(new AppError(`Plan ${requiredPlan} required.`, 403));
  };
}

module.exports = {
  planPriority,
  ACCESS_STATUSES,
  hasActiveSubscription,
  resolveEffectivePlan,
  syncPlanStatus,
  requirePlan,
};
