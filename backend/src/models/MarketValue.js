const mongoose = require("mongoose");

// One document per valuation snapshot; references the Player that is its subject.
// Separate collection: compound unique on (player, date), indexed reads by player over time.
// No tiemstamps to avoid confusion with date
const marketValueSchema = new mongoose.Schema({
  // Player whose valuation this is
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Player",
    required: true,
  },

  date: { type: Date, required: true },
  value: { type: Number, required: true, min: 0 },
});

// Date is defined as -1 so that newest first rule applies
marketValueSchema.index({ player: 1, date: -1 }, { unique: true });
// Finds the newest valuation in the whole collection (current market window cutoff)
marketValueSchema.index({ date: -1 });

module.exports = mongoose.model("MarketValue", marketValueSchema);
