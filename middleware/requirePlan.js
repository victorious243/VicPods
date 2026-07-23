const { AppError } = require('../utils/errors');
const { reconcileUserBilling } = require('../services/stripe/billingReconciliation');
const { enforceTesterTrialExpiry } = require('../services/marketing/trialInviteService');
const {
  WORKSPACE_PRIORITY,
  getLegacyPlanForWorkspacePlan,
  getWorkspacePlanForLegacyPlan,
  normalizeHostingPlan,
  normalizeWorkspacePlan,
} = require('../services/billing/planCatalog');
const {
  getEffectiveHostingPlanForBilling,
} = require('../services/billing/usageLimitsService');

const planPriority = {
  free: 0,
  pro: 1,
  premium: 2,
};

const ACCESS_STATUSES = new Set(['active', 'trialing']);
const ADMIN_DEFAULT_PLAN = 'premium';
const ADMIN_DEFAULT_WORKSPACE_PLAN = 'studio';

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

function getAdminEffectiveWorkspacePlan(user) {
  if (!isAdmin(user)) {
    return null;
  }

  return normalizeWorkspacePlan(user.workspacePlan || ADMIN_DEFAULT_WORKSPACE_PLAN) === 'free'
    ? ADMIN_DEFAULT_WORKSPACE_PLAN
    : normalizeWorkspacePlan(user.workspacePlan || ADMIN_DEFAULT_WORKSPACE_PLAN);
}

function getStoredWorkspacePlan(user) {
  const legacyWorkspacePlan = getWorkspacePlanForLegacyPlan(user?.plan);
  const explicitWorkspacePlan = normalizeWorkspacePlan(user?.workspacePlan);

  if (explicitWorkspacePlan === 'free' && legacyWorkspacePlan !== 'free') {
    return legacyWorkspacePlan;
  }

  return explicitWorkspacePlan;
}

function hasPaymentGrace(status, graceUntil, now = new Date()) {
  if (String(status || '').trim().toLowerCase() !== 'past_due' || !graceUntil) {
    return false;
  }

  return new Date(graceUntil).getTime() > now.getTime();
}

function hasActiveSubscription(user, now = new Date()) {
  if (!user) {
    return false;
  }

  if (hasPaymentGrace(user.planStatus, user.workspacePaymentGraceUntil, now)) {
    return true;
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

function resolveEffectiveWorkspacePlan(user, now = new Date()) {
  if (!user) {
    return 'free';
  }

  const adminPlan = getAdminEffectiveWorkspacePlan(user);
  if (adminPlan) {
    return adminPlan;
  }

  const storedWorkspacePlan = getStoredWorkspacePlan(user);
  if (storedWorkspacePlan === 'free') {
    return 'free';
  }

  const workspaceStatus = user.workspacePlanStatus || user.planStatus;
  const workspacePeriodEnd = user.workspaceCurrentPeriodEnd || user.currentPeriodEnd;

  if (hasPaymentGrace(workspaceStatus, user.workspacePaymentGraceUntil, now)) {
    return storedWorkspacePlan;
  }

  if (!ACCESS_STATUSES.has(workspaceStatus)) {
    return 'free';
  }

  if (!workspacePeriodEnd) {
    return 'free';
  }

  return new Date(workspacePeriodEnd).getTime() > now.getTime() ? storedWorkspacePlan : 'free';
}

async function syncPlanStatus(req, res, next) {
  try {
    if (!req.currentUser) {
      res.locals.effectivePlan = 'free';
      return next();
    }

    if (isAdmin(req.currentUser)) {
      const adminPlan = getAdminEffectivePlan(req.currentUser);
      const adminWorkspacePlan = getAdminEffectiveWorkspacePlan(req.currentUser);
      req.effectivePlan = adminPlan;
      req.effectiveWorkspacePlan = adminWorkspacePlan;
      res.locals.effectivePlan = adminPlan;
      res.locals.effectiveWorkspacePlan = adminWorkspacePlan;

      let changed = false;
      if (req.currentUser.plan !== adminPlan) {
        req.currentUser.plan = adminPlan;
        changed = true;
      }
      if (req.currentUser.workspacePlan !== adminWorkspacePlan) {
        req.currentUser.workspacePlan = adminWorkspacePlan;
        changed = true;
      }
      if (req.currentUser.hostingPlan !== 'studio') {
        req.currentUser.hostingPlan = 'studio';
        changed = true;
      }
      if (req.currentUser.planStatus !== 'active') {
        req.currentUser.planStatus = 'active';
        changed = true;
      }
      if (req.currentUser.workspacePlanStatus !== 'active') {
        req.currentUser.workspacePlanStatus = 'active';
        changed = true;
      }
      if (req.currentUser.hostingPlanStatus !== 'active') {
        req.currentUser.hostingPlanStatus = 'active';
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
      if (!req.currentUser.workspaceCurrentPeriodEnd || req.currentUser.workspaceCurrentPeriodEnd.getTime() <= Date.now()) {
        req.currentUser.workspaceCurrentPeriodEnd = new Date('2099-12-31T23:59:59.000Z');
        changed = true;
      }
      if (!req.currentUser.hostingCurrentPeriodEnd || req.currentUser.hostingCurrentPeriodEnd.getTime() <= Date.now()) {
        req.currentUser.hostingCurrentPeriodEnd = new Date('2099-12-31T23:59:59.000Z');
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

    const testerTrialExpiry = await enforceTesterTrialExpiry(req.currentUser);
    if (!testerTrialExpiry.expired) {
      try {
        await reconcileUserBilling(req.currentUser);
        res.locals.currentUser = req.currentUser;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Billing reconciliation skipped for ${req.currentUser._id}: ${error.message}`);
      }
    }

    const now = new Date();
    const effectiveWorkspacePlan = resolveEffectiveWorkspacePlan(req.currentUser, now);
    const effectivePlan = getLegacyPlanForWorkspacePlan(effectiveWorkspacePlan);
    req.effectivePlan = effectivePlan;
    req.effectiveWorkspacePlan = effectiveWorkspacePlan;
    res.locals.effectivePlan = effectivePlan;
    res.locals.effectiveWorkspacePlan = effectiveWorkspacePlan;

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

    const storedWorkspacePlan = getStoredWorkspacePlan(req.currentUser);
    if (WORKSPACE_PRIORITY[storedWorkspacePlan] < WORKSPACE_PRIORITY[effectiveWorkspacePlan]) {
      req.currentUser.workspacePlan = effectiveWorkspacePlan;
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

function hasActiveHostingSubscription(user, now = new Date()) {
  if (!user) {
    return false;
  }

  if (hasPaymentGrace(user.hostingPlanStatus, user.hostingPaymentGraceUntil, now)) {
    return true;
  }

  if (!ACCESS_STATUSES.has(String(user.hostingPlanStatus || '').trim().toLowerCase())) {
    return false;
  }

  if (!user.hostingCurrentPeriodEnd) {
    return false;
  }

  return new Date(user.hostingCurrentPeriodEnd).getTime() > now.getTime();
}

function resolveEffectiveHostingPlan(user, now = new Date()) {
  if (!user) {
    return 'none';
  }

  if (isAdmin(user)) {
    return 'studio';
  }

  return getEffectiveHostingPlanForBilling({
    workspacePlan: resolveEffectiveWorkspacePlan(user, now),
    hostingPlan: user.hostingPlan || 'none',
    hostingActive: hasActiveHostingSubscription(user, now),
  });
}

function requirePublishingAccess(req, res, next) {
  const effectiveWorkspacePlan = req.effectiveWorkspacePlan
    || resolveEffectiveWorkspacePlan(req.currentUser);
  const effectiveHostingPlan = resolveEffectiveHostingPlan(req.currentUser);
  const hasWorkspacePublishing = WORKSPACE_PRIORITY[effectiveWorkspacePlan] >= WORKSPACE_PRIORITY.creator;
  const hasHostingPublishing = normalizeHostingPlan(effectiveHostingPlan) !== 'none';

  if (hasWorkspacePublishing || hasHostingPublishing) {
    req.effectiveHostingPlan = effectiveHostingPlan;
    res.locals.effectiveHostingPlan = effectiveHostingPlan;
    return next();
  }

  if (req.accepts('html')) {
    req.flash('error', 'Publishing requires a Creator workspace plan or an active hosting plan.');
    return res.redirect('/settings?section=billing');
  }

  return next(new AppError('Publishing access required.', 403));
}

module.exports = {
  planPriority,
  ACCESS_STATUSES,
  hasPaymentGrace,
  hasActiveSubscription,
  hasActiveHostingSubscription,
  resolveEffectivePlan,
  resolveEffectiveHostingPlan,
  resolveEffectiveWorkspacePlan,
  syncPlanStatus,
  requirePlan,
  requirePublishingAccess,
};
