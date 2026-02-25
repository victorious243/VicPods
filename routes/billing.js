const express = require('express');
const billingController = require('../controllers/billingController');

const router = express.Router();

router.get('/', billingController.showBilling);
router.post('/checkout', billingController.createCheckout);
router.post('/portal', billingController.openPortal);
router.get('/success', billingController.showSuccess);
router.get('/cancel', billingController.showCancel);

module.exports = router;
