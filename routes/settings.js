const express = require('express');
const settingsController = require('../controllers/settingsController');

const router = express.Router();

router.get('/', settingsController.showSettings);
router.post('/profile', settingsController.updateProfile);
router.post('/appearance', settingsController.updateAppearance);
router.post('/security/password', settingsController.updatePassword);
router.post('/security/delete-account', settingsController.deleteAccount);
router.post('/onboarding/reset', settingsController.resetOnboarding);

module.exports = router;
