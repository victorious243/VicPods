const express = require('express');
const aiController = require('../controllers/aiController');
const { enforceAiRateLimit } = require('../middleware/aiRateLimit');
const { requirePlan } = require('../middleware/plan');

const router = express.Router();

router.post('/episode/generate', requirePlan('free'), enforceAiRateLimit, aiController.generateEpisode);
router.post('/spices/generate', requirePlan('free'), enforceAiRateLimit, aiController.generateSpices);
router.post('/continuity/refresh', requirePlan('pro'), aiController.refreshContinuity);

module.exports = router;
