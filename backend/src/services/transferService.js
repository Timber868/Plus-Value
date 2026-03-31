// services/transferService.js — Business logic layer for transfers
// TODO: implement data-access + ROI calculation logic

// const Transfer = require('../models/Transfer');

exports.findAll = async (query = {}) => {
  // TODO: support filters: season, club, type, dateRange
  // TODO: return Transfer.find(filter).populate('player fromClub toClub');
  return [];
};

exports.findById = async (id) => {
  // TODO: return Transfer.findById(id).populate('player fromClub toClub');
  return null;
};

exports.create = async (data) => {
  // TODO: return Transfer.create(data);
  return null;
};

exports.update = async (id, data) => {
  // TODO: return Transfer.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  return null;
};

exports.remove = async (id) => {
  // TODO: return Transfer.findByIdAndDelete(id);
  return null;
};

/**
 * Calculates the transfer ROI for all transfers involving a club.
 * ROI = (current market value − fee paid) / fee paid × 100
 * @param {string} clubId
 */
exports.calculateROI = async (clubId) => {
  // TODO: aggregate transfers where toClub === clubId
  // TODO: for each, fetch current player.marketValue and compute ROI
  return { clubId, transfers: [], averageROI: null };
};
