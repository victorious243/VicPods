const express = require('express');
const pantryController = require('../controllers/pantryController');

const router = express.Router();

router.get('/', pantryController.showPantry);
router.post('/', pantryController.createIdea);
router.post('/:ideaId/update', pantryController.updateIdea);
router.post('/:ideaId/delete', pantryController.deleteIdea);

module.exports = router;
