const express = require('express');
const authController = require('../controllers/authController');
const { requireAuth, requireGuest, requireSessionUser } = require('../middleware/auth');
const { authLimiter } = require('../middleware/authRateLimit');

const router = express.Router();

router.get('/register', requireGuest, authController.showRegister);
router.post('/register', authLimiter, requireGuest, authController.register);
router.get('/terms', authController.showTerms);
router.get('/login', requireGuest, authController.showLogin);
router.get('/mojo/login', requireGuest, authController.loginWithMojo);
router.get('/google/login', requireGuest, authController.loginWithGoogle);
router.get('/google/signup', requireGuest, authController.loginWithGoogle);
router.post('/login', authLimiter, requireGuest, authController.login);
router.get('/verify', requireGuest, authController.showVerify);
router.post('/verify', authLimiter, requireGuest, authController.verify);
router.post('/verify/resend', authLimiter, requireGuest, authController.resendPin);
router.get('/callback', requireGuest, authController.mojoCallback);
router.get('/google/callback', requireGuest, authController.googleCallback);
router.post('/logout', requireSessionUser, authController.logout);

module.exports = router;
