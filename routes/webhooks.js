const express = require('express');
const stripeWebhookController = require('../controllers/stripeWebhookController');

const router = express.Router();

router.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhookController.handleWebhook);

module.exports = router;
