// routes/clubRoutes.js — Express router for /api/v1/clubs

const express = require('express');
const router = express.Router();
const clubController = require('../controllers/clubController');
// const { authenticate } = require('../middleware/auth');

router.get('/',    clubController.getAllClubs);
router.get('/:id', clubController.getClubById);
router.post('/',   /* authenticate, */ clubController.createClub);
router.put('/:id', /* authenticate, */ clubController.updateClub);
router.delete('/:id', /* authenticate, */ clubController.deleteClub);

module.exports = router;
