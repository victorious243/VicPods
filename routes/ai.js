const express = require('express');
const aiController = require('../controllers/aiController');
const { enforceAiRateLimit } = require('../middleware/aiRateLimit');
const { requirePlan } = require('../middleware/requirePlan');

const router = express.Router();

router.post('/episode/generate', requirePlan('free'), enforceAiRateLimit, aiController.generateEpisode);
router.post('/spices/generate', requirePlan('free'), enforceAiRateLimit, aiController.generateSpices);
router.post('/hooks/generate', requirePlan('free'), enforceAiRateLimit, aiController.generateHooks);
router.post('/hooks/apply', requirePlan('free'), aiController.applyHookOption);
router.post('/rewrite/section', requirePlan('free'), enforceAiRateLimit, aiController.rewriteSection);
router.post('/help/chat', aiController.answerHelpChat);
router.post('/continuity/refresh', requirePlan('pro'), aiController.refreshContinuity);
router.post('/tone/fix', requirePlan('premium'), enforceAiRateLimit, aiController.fixTone);

module.exports = router;
