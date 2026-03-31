// services/clubService.js — Business logic layer for clubs
// TODO: implement data-access operations with Mongoose

// const Club = require('../models/Club');

exports.findAll = async (query = {}) => {
  // TODO: return Club.find().populate('squad');
  return [];
};

exports.findById = async (id) => {
  // TODO: return Club.findById(id).populate('squad');
  return null;
};

exports.create = async (data) => {
  // TODO: return Club.create(data);
  return null;
};

exports.update = async (id, data) => {
  // TODO: return Club.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  return null;
};

exports.remove = async (id) => {
  // TODO: return Club.findByIdAndDelete(id);
  return null;
};
