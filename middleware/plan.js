const { AppError } = require('../utils/errors');

const planPriority = {
  free: 0,
  pro: 1,
  premium: 2,
};

function requirePlan(requiredPlan) {
  return (req, res, next) => {
    const currentPlan = req.currentUser?.plan || 'free';

    if (planPriority[currentPlan] >= planPriority[requiredPlan]) {
      return next();
    }

    if (req.accepts('html')) {
      req.flash('error', `This feature requires the ${requiredPlan} plan.`);
      return res.redirect('/billing');
    }

    return next(new AppError(`Plan ${requiredPlan} required.`, 403));
  };
}

module.exports = {
  requirePlan,
};
