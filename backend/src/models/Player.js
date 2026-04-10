const mongoose = require("mongoose");

// Mongoose schema for the players
const playerSchema = new mongoose.Schema(
  {
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
