// controllers/playerController.js — Handles HTTP requests for players
// TODO: implement CRUD operations using playerService

const playerService = require('../services/playerService');

/**
 * GET /api/v1/players
 * Returns a paginated list of players.
 */
exports.getAllPlayers = async (req, res, next) => {
  // TODO: const players = await playerService.findAll(req.query);
  // TODO: res.json({ success: true, data: players });
  res.json({ success: true, data: [], message: 'getAllPlayers — not yet implemented' });
};

/**
 * GET /api/v1/players/:id
 * Returns a single player by ID.
 */
exports.getPlayerById = async (req, res, next) => {
  // TODO: const player = await playerService.findById(req.params.id);
  res.json({ success: true, data: null, message: 'getPlayerById — not yet implemented' });
};

/**
 * POST /api/v1/players
 * Creates a new player.
 */
exports.createPlayer = async (req, res, next) => {
  // TODO: const player = await playerService.create(req.body);
  // TODO: res.status(201).json({ success: true, data: player });
  res.status(201).json({ success: true, data: null, message: 'createPlayer — not yet implemented' });
};

/**
 * PUT /api/v1/players/:id
 * Updates an existing player.
 */
exports.updatePlayer = async (req, res, next) => {
  // TODO: const player = await playerService.update(req.params.id, req.body);
  res.json({ success: true, data: null, message: 'updatePlayer — not yet implemented' });
};

/**
 * DELETE /api/v1/players/:id
 * Deletes a player by ID.
 */
exports.deletePlayer = async (req, res, next) => {
  // TODO: await playerService.remove(req.params.id);
  res.json({ success: true, message: 'deletePlayer — not yet implemented' });
};
