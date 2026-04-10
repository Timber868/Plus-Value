const mongoose = require("mongoose");

// Transfer: one player (subject), buyer club, optional seller (e.g. free transfers), and season.
const transferSchema = new mongoose.Schema(
  {
    // Transfer subject — exactly one player per transfer document
    player: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },

    // A buyer is required as a player needs to be going somewhere
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },

    // No seller required. A free transfer or a youth signing might not have a seller.
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: false,
    },

    // Each transfer happens during a season
    season: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
    },

    // Transfer information that is important to display
    date: { type: Date, required: true },
    price: { type: Number, min: 0 },
    window: { type: String, trim: true },
  },
  {
    timestamps: true,
  },
);

// List one player’s transfers in time order (e.g. history, newest first) without scanning the whole collection.
transferSchema.index({ player: 1, date: -1 });
// List transfers in a given season by date (e.g. window activity, reports).
transferSchema.index({ season: 1, date: -1 });

module.exports = mongoose.model("Transfer", transferSchema);
