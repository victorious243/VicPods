const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  if (req.currentUser) {
    return res.redirect('/studio');
  }

  return res.redirect('/auth/login');
});

module.exports = router;
