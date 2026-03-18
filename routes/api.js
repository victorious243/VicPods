const express = require('express');

const apiController = require('../controllers/apiController');
const { authLimiter } = require('../middleware/authRateLimit');

const router = express.Router();

router.post('/auth/register', authLimiter, apiController.register);
router.post('/auth/login', authLimiter, apiController.login);
router.get('/auth/session', apiController.session);
router.post('/auth/logout', apiController.logout);

router.get('/studio', apiController.studio);

module.exports = router;
