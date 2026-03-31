// routes/playerRoutes.js — Express router for /api/v1/players
// TODO: add validation middleware per route

const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');
// const { authenticate } = require('../middleware/auth');
// const { validatePlayer } = require('../middleware/validation');

router.get('/',    playerController.getAllPlayers);
router.get('/:id', playerController.getPlayerById);
router.post('/',   /* authenticate, validatePlayer, */ playerController.createPlayer);
router.put('/:id', /* authenticate, validatePlayer, */ playerController.updatePlayer);
router.delete('/:id', /* authenticate, */ playerController.deletePlayer);

module.exports = router;
