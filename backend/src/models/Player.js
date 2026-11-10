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

    // Position from the dataset: "Goalkeeper", "Defender", "Midfield" or
    // "Attack", and the finer sub-position (e.g. "Centre-Forward"). Null when
    // the dataset has none.
    position: { type: String, default: null, trim: true },
    subPosition: { type: String, default: null, trim: true },

    // End of the player's current contract, as the dataset last saw it.
    // Null when unknown (free agents, retired players, missing data).
    contractExpiresAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Player", playerSchema);
