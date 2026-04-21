const express = require('express');
const feedbackController = require('../controllers/feedbackController');

const router = express.Router();

router.get('/', feedbackController.showFeedbackForm);
router.post('/', feedbackController.submitFeedback);

module.exports = router;
