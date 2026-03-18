const completeOnboarding = async (req, res, next) => {
  try {
    if (!req.currentUser) {
      return res.status(401).json({
        ok: false,
        message: 'User is not authenticated.',
      });
    }

    req.currentUser.onboardingCompletedAt = new Date();
    await req.currentUser.save();

    return res.json({ ok: true, completedAt: req.currentUser.onboardingCompletedAt });
  } catch (error) {
    return next(error);
  }
};

const skipOnboarding = async (req, res, next) => {
  try {
    if (!req.currentUser) {
      return res.status(401).json({
        ok: false,
        message: 'User is not authenticated.',
      });
    }

    req.currentUser.onboardingCompletedAt = new Date();
    await req.currentUser.save();

    return res.json({ ok: true, completedAt: req.currentUser.onboardingCompletedAt });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  completeOnboarding,
  skipOnboarding,
};
