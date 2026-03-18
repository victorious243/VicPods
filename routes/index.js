const express = require('express');
const authController = require('../controllers/authController');
const aboutController = require('../controllers/aboutController');
const helpController = require('../controllers/helpController');
const landingController = require('../controllers/landingController');
const { requireGuest } = require('../middleware/auth');

const router = express.Router();
router.get('/oauth2callback', requireGuest, authController.googleCallback);
router.get('/lab', landingController.showLanding);
router.get('/about', aboutController.showAbout);
router.get('/help', helpController.showHelp);
router.get('/', landingController.showLanding);

module.exports = router;
