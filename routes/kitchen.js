const express = require('express');
const kitchenController = require('../controllers/kitchenController');
const transcriptController = require('../controllers/transcriptController');

const router = express.Router();

router.get('/', kitchenController.listSeries);
router.post('/', kitchenController.createSeries);
router.get('/:seriesId', kitchenController.showSeries);
router.post('/:seriesId/themes', kitchenController.createTheme);
router.post('/:seriesId/themes/:themeId/episodes', kitchenController.createEpisodeInTheme);
router.get('/:seriesId/themes/:themeId/episodes/:episodeId', kitchenController.showEpisodeEditor);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId', kitchenController.saveEpisode);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId/delete', kitchenController.deleteEpisode);
router.post(
  '/:seriesId/themes/:themeId/episodes/:episodeId/transcript/generate',
  transcriptController.generateTranscript
);
router.get(
  '/:seriesId/themes/:themeId/episodes/:episodeId/transcript/download',
  transcriptController.downloadTranscript
);

module.exports = router;
