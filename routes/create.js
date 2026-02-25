const express = require('express');
const createController = require('../controllers/createController');
const { requirePlan } = require('../middleware/requirePlan');

const router = express.Router();

router.get('/', createController.showCreateHub);
router.get('/single', createController.showSingleWizard);
router.post('/single', createController.createSingleEpisode);
router.get('/series', createController.showSeriesWizard);
router.post('/series', createController.createSeriesFlow);
router.post('/series/suggest-themes', requirePlan('pro'), createController.suggestSeriesThemes);

module.exports = router;
