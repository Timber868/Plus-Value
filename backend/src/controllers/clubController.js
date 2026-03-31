// controllers/clubController.js — Handles HTTP requests for clubs
// TODO: implement CRUD operations using clubService

const clubService = require('../services/clubService');

/**
 * GET /api/v1/clubs
 */
exports.getAllClubs = async (req, res, next) => {
  // TODO: const clubs = await clubService.findAll(req.query);
  res.json({ success: true, data: [], message: 'getAllClubs — not yet implemented' });
};

/**
 * GET /api/v1/clubs/:id
 */
exports.getClubById = async (req, res, next) => {
  // TODO: const club = await clubService.findById(req.params.id);
  res.json({ success: true, data: null, message: 'getClubById — not yet implemented' });
};

/**
 * POST /api/v1/clubs
 */
exports.createClub = async (req, res, next) => {
  // TODO: const club = await clubService.create(req.body);
  res.status(201).json({ success: true, data: null, message: 'createClub — not yet implemented' });
};

/**
 * PUT /api/v1/clubs/:id
 */
exports.updateClub = async (req, res, next) => {
  // TODO: const club = await clubService.update(req.params.id, req.body);
  res.json({ success: true, data: null, message: 'updateClub — not yet implemented' });
};

/**
 * DELETE /api/v1/clubs/:id
 */
exports.deleteClub = async (req, res, next) => {
  // TODO: await clubService.remove(req.params.id);
  res.json({ success: true, message: 'deleteClub — not yet implemented' });
};
