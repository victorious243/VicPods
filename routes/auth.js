const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, requireGuest, requireSessionUser } = require('../middleware/auth');
const { authLimiter } = require('../middleware/authRateLimit');

const router = express.Router();

router.get('/register', requireGuest, authController.showRegister);
router.post('/register', authLimiter, requireGuest, authController.register);
router.get('/terms', authController.showTerms);
router.get('/login', requireGuest, authController.showLogin);
router.get('/forgot-password', requireGuest, authController.showForgotPassword);
router.get('/google', requireGuest, authController.loginWithGoogle);
router.get('/google/login', requireGuest, authController.loginWithGoogle);
router.get('/google/signup', requireGuest, authController.loginWithGoogle);
router.post('/login', authLimiter, requireGuest, authController.login);
router.post('/forgot-password', authLimiter, requireGuest, authController.forgotPassword);
router.get('/verify', requireGuest, authController.showVerify);
router.get('/reset-password', requireGuest, authController.showResetPassword);
router.post('/verify', authLimiter, requireGuest, authController.verify);
router.post('/verify/resend', authLimiter, requireGuest, authController.resendPin);
router.post('/reset-password', authLimiter, requireGuest, authController.resetPassword);
router.get('/mfa', requireGuest, authController.showMfa);
router.post('/mfa', authLimiter, requireGuest, authController.verifyMfa);
router.post('/mfa/resend', authLimiter, requireGuest, authController.resendMfa);
router.get('/google/callback', requireGuest, authController.googleCallback);
router.post('/logout', requireSessionUser, authController.logout);

module.exports = router;
