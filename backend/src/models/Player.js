const mongoose = require("mongoose");

// Mongoose schema for the players
const playerSchema = new mongoose.Schema(
  {
    // Natural key from the Transfermarkt dataset (e.g. "342229"). Used as the
    // upsert key when syncing players from DuckDB and to link valuations and
    // transfers to the right player.
    playerId: { type: String, required: true, unique: true, trim: true },

    // A player is also a person
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Player", playerSchema);
