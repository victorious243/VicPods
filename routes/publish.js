const express = require('express');
const publishController = require('../controllers/publishController');
const { requirePlan } = require('../middleware/requirePlan');

const router = express.Router();

router.use(requirePlan('pro'));

router.get('/shows', publishController.listShows);
router.post('/shows', publishController.createShow);
router.post('/shows/import', publishController.importShowFromFeed);
router.post('/shows/:showId/settings', publishController.updateShowSettings);
router.post('/shows/:showId/directories/:platformKey', publishController.updateShowDirectorySubmission);
router.post('/shows/:showId/domain/verify', publishController.verifyShowCustomDomain);
router.post('/shows/:showId/cover', publishController.uploadShowCover);
router.post('/episodes/:episodeId/audio', publishController.uploadEpisodeAudio);
router.post('/episodes/:episodeId/settings', publishController.updateEpisodePublication);

module.exports = router;
