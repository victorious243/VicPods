const { normalizeReferralCode } = require('../services/marketing/referralService');

function captureReferralContext(req, res, next) {
  const incomingCode = normalizeReferralCode(req.query?.ref || '');
  const currentUserCode = normalizeReferralCode(req.currentUser?.referralCode || '');

  if (req.session && !req.currentUser && incomingCode && incomingCode !== currentUserCode) {
    req.session.referralCode = incomingCode;
  }

  res.locals.pendingReferralCode = normalizeReferralCode(req.session?.referralCode || '');
  return next();
}

module.exports = {
  captureReferralContext,
};
