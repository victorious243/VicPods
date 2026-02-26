const express = require('express');
const authController = require('../controllers/authController');
const { requireGuest } = require('../middleware/auth');

const router = express.Router();

router.get('/callback', requireGuest, authController.mojoCallback);
router.get('/oauth2callback', requireGuest, authController.googleCallback);

router.get('/', (req, res) => {
  if (req.currentUser) {
    if (req.currentUser.emailVerified === false) {
      return res.redirect(`/auth/verify?email=${encodeURIComponent(req.currentUser.email)}`);
    }
    return res.redirect('/studio');
  }

  return res.redirect('/auth/login');
});

module.exports = router;
