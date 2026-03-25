const { AppError } = require('../utils/errors');
const { reconcileUserBilling } = require('../services/stripe/billingReconciliation');

const planPriority = {
  free: 0,
  pro: 1,
  premium: 2,
};

const ACCESS_STATUSES = new Set(['active', 'trialing']);
const ADMIN_DEFAULT_PLAN = 'premium';

function isAdmin(user) {
  return Boolean(user && user.role === 'admin');
}

function getAdminEffectivePlan(user) {
  if (!isAdmin(user)) {
    return null;
  }

  if (user.plan === 'pro' || user.plan === 'premium') {
    return user.plan;
  }

  return ADMIN_DEFAULT_PLAN;
}

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

  const adminPlan = getAdminEffectivePlan(user);
  if (adminPlan) {
    return adminPlan;
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

    if (isAdmin(req.currentUser)) {
      const adminPlan = getAdminEffectivePlan(req.currentUser);
      req.effectivePlan = adminPlan;
      res.locals.effectivePlan = adminPlan;

      let changed = false;
      if (req.currentUser.plan !== adminPlan) {
        req.currentUser.plan = adminPlan;
        changed = true;
      }
      if (req.currentUser.planStatus !== 'active') {
        req.currentUser.planStatus = 'active';
        changed = true;
      }
      if (!req.currentUser.currentPeriodStart) {
        req.currentUser.currentPeriodStart = new Date();
        changed = true;
      }
      if (!req.currentUser.currentPeriodEnd || req.currentUser.currentPeriodEnd.getTime() <= Date.now()) {
        req.currentUser.currentPeriodEnd = new Date('2099-12-31T23:59:59.000Z');
        changed = true;
      }
      if (req.currentUser.cancelAtPeriodEnd) {
        req.currentUser.cancelAtPeriodEnd = false;
        changed = true;
      }

      if (changed) {
        await req.currentUser.save();
        res.locals.currentUser = req.currentUser;
      }

      return next();
    }

    try {
      await reconcileUserBilling(req.currentUser);
      res.locals.currentUser = req.currentUser;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Billing reconciliation skipped for ${req.currentUser._id}: ${error.message}`);
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
