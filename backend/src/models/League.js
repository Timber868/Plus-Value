const mongoose = require("mongoose");

// Mongoose schema for the leagues
const leagueSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    confederation: { type: String, required: true, trim: true },

    // Not super necessary to have a tier
    tier: {
      type: Number,
      max: 5,
      min: 1,
    },

    // Competition format can be either league or cup
    competitionFormat: {
      type: String,
      enum: ["cup", "league"],
      default: "league",
      required: true,
    },

    // Could not be a tier with european spots
    europeanSpots: Number,
  },
  {
    timestamps: true,
  },
);

// Export the League schema
module.exports = mongoose.model("League", leagueSchema);
