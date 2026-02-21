const express = require('express');
const studioController = require('../controllers/studioController');

const router = express.Router();

router.get('/', studioController.showStudio);

module.exports = router;
