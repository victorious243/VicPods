const express = require('express');
const onboardingController = require('../controllers/onboardingController');

const router = express.Router();

router.post('/complete', onboardingController.completeOnboarding);
router.post('/skip', onboardingController.skipOnboarding);

module.exports = router;
