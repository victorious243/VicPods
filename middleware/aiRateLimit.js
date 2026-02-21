const { consumeAiCredit } = require('../services/limitService');

async function enforceAiRateLimit(req, res, next) {
  try {
    await consumeAiCredit(req.currentUser);
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  enforceAiRateLimit,
};
