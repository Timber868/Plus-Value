// models/Transfer.js — Mongoose schema & model for a player transfer
// TODO: define fields (player, fromClub, toClub, fee, date, type, ROI, etc.)

const mongoose = require('mongoose');

const transferSchema = new mongoose.Schema(
  {
    // TODO: player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    // TODO: fromClub: { type: mongoose.Schema.Types.ObjectId, ref: 'Club' },
    // TODO: toClub: { type: mongoose.Schema.Types.ObjectId, ref: 'Club', required: true },
    // TODO: fee: { amount: Number, currency: { type: String, default: 'EUR' } },
    // TODO: transferDate: { type: Date, required: true },
    // TODO: type: { type: String, enum: ['permanent', 'loan', 'free', 'youth'] },
    // TODO: season: String,          // e.g. "2024-25"
    // TODO: roi: Number,             // calculated return on investment %
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transfer', transferSchema);
