const express = require('express');
const authController = require('../controllers/authController');
const { requireGuest } = require('../middleware/auth');

const router = express.Router();

router.get('/register', requireGuest, authController.showRegister);
router.post('/register', requireGuest, authController.register);
router.get('/login', requireGuest, authController.showLogin);
router.post('/login', requireGuest, authController.login);
router.post('/logout', authController.logout);

module.exports = router;
