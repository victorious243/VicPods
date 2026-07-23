const express = require('express');
const studioController = require('../controllers/studioController');

const router = express.Router();

router.get('/', studioController.showStudio);
router.get('/analytics', studioController.showAnalytics);
router.get('/monetization', studioController.showMonetization);
router.post('/monetization/shows/:showId', studioController.updateShowMonetization);
router.get('/teams', studioController.showTeams);
router.post('/teams/shows/:showId/collaborators', studioController.addShowCollaborator);
router.post('/teams/shows/:showId/brand-kit', studioController.updateShowBrandKit);
router.get('/integrations', studioController.showIntegrations);
router.post('/integrations/connections', studioController.saveIntegrationConnection);
router.post('/integrations/connections/:connectionId/test', studioController.sendIntegrationConnectionTest);
router.post('/integrations/deliveries/:deliveryId/retry', studioController.retryIntegrationDelivery);
router.get('/calendar', studioController.showStudioCalendar);

module.exports = router;
