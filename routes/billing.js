const express = require('express');
const billingController = require('../controllers/billingController');

const router = express.Router();

router.get('/', billingController.showBilling);

module.exports = router;
