const { normalizeReferralCode } = require('../services/marketing/referralService');
const { normalizeTrialInviteCode } = require('../services/marketing/trialInviteService');

function captureReferralContext(req, res, next) {
  const incomingCode = normalizeReferralCode(req.query?.ref || '');
  const incomingTrialCode = normalizeTrialInviteCode(req.query?.trial || '');
  const currentUserCode = normalizeReferralCode(req.currentUser?.referralCode || '');

  if (req.session && !req.currentUser && incomingCode && incomingCode !== currentUserCode) {
    req.session.referralCode = incomingCode;
  }

  if (req.session && !req.currentUser && incomingTrialCode) {
    req.session.trialInviteCode = incomingTrialCode;
  }

  res.locals.pendingReferralCode = normalizeReferralCode(req.session?.referralCode || '');
  res.locals.pendingTrialInviteCode = normalizeTrialInviteCode(req.session?.trialInviteCode || '');
  return next();
}

module.exports = {
  captureReferralContext,
};
