// models/Player.js — Mongoose schema & model for a Ligue 1 player
// TODO: define fields (name, position, club, marketValue, nationality, stats, etc.)

const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    // TODO: name: { type: String, required: true, trim: true },
    // TODO: position: { type: String, enum: ['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST'] },
    // TODO: club: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
    // TODO: nationality: String,
    // TODO: dateOfBirth: Date,
    // TODO: marketValue: { amount: Number, currency: { type: String, default: 'EUR' } },
    // TODO: contractUntil: Date,
    // TODO: stats: { goals: Number, assists: Number, appearances: Number },
  },
  { timestamps: true }
);

// TODO: add indexes, virtual fields, and instance/static methods

module.exports = mongoose.model('Player', playerSchema);
