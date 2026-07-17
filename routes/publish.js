const express = require('express');
const publishController = require('../controllers/publishController');
const { requirePlan } = require('../middleware/requirePlan');

const router = express.Router();

router.use(requirePlan('pro'));

router.get('/shows', publishController.listShows);
router.post('/shows', publishController.createShow);
router.post('/episodes/:episodeId/audio', publishController.uploadEpisodeAudio);
router.post('/episodes/:episodeId/settings', publishController.updateEpisodePublication);

module.exports = router;
