// models/Club.js — Mongoose schema & model for a Ligue 1 club
// TODO: define fields (name, shortName, city, stadium, budget, squad, etc.)

const mongoose = require('mongoose');

const clubSchema = new mongoose.Schema(
  {
    // TODO: name: { type: String, required: true, trim: true },
    // TODO: shortName: String,
    // TODO: city: String,
    // TODO: stadium: String,
    // TODO: foundedYear: Number,
    // TODO: transferBudget: { amount: Number, currency: { type: String, default: 'EUR' } },
    // TODO: squad: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Player' }],
    // TODO: logoUrl: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Club', clubSchema);
