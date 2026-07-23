const express = require('express');
const kitchenController = require('../controllers/kitchenController');
const transcriptController = require('../controllers/transcriptController');

const router = express.Router();

router.get('/', kitchenController.listSeries);
router.post('/', kitchenController.createSeries);
router.get('/:seriesId', kitchenController.showSeries);
router.post('/:seriesId/settings', kitchenController.updateSeriesSettings);
router.post('/:seriesId/themes', kitchenController.createTheme);
router.post('/:seriesId/themes/:themeId/episodes', kitchenController.createEpisodeInTheme);
router.get('/:seriesId/themes/:themeId/episodes/:episodeId', kitchenController.showEpisodeEditor);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId', kitchenController.saveEpisode);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId/recording', kitchenController.updateRecordingWorkflow);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId/work-items', kitchenController.addEpisodeWorkItem);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId/approval', kitchenController.updateEpisodeApproval);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId/advanced-media', kitchenController.updateAdvancedMedia);
router.post('/:seriesId/themes/:themeId/episodes/:episodeId/delete', kitchenController.deleteEpisode);
router.post(
  '/:seriesId/themes/:themeId/episodes/:episodeId/transcript/generate',
  transcriptController.generateTranscript
);
router.post(
  '/:seriesId/themes/:themeId/episodes/:episodeId/transcript/import',
  transcriptController.importTranscript
);
router.get(
  '/:seriesId/themes/:themeId/episodes/:episodeId/transcript/download',
  transcriptController.downloadTranscript
);
router.get(
  '/:seriesId/themes/:themeId/episodes/:episodeId/preview/download',
  transcriptController.downloadLightPreview
);

module.exports = router;
