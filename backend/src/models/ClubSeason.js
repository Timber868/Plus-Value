const mongoose = require("mongoose");

// Join: club participates in a season (league context comes from Season.league).
// In each season a club has a respective ranking and points
const clubSeasonSchema = new mongoose.Schema(
  {
    // Link to a club
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },

    // Link the a season the club was a part of
    season: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
    },

    // Points gotten by the club during the season does not have to be positive as penalties exist
    points: {
      type: Number,
      default: 0,
    },

    // Final/current table position for this club in this season (optional until known)
    standing: {
      type: Number,
      min: 1,
    },
  },
  {
    timestamps: true,
  },
);

// One participation row per club per season
clubSeasonSchema.index({ club: 1, season: 1 }, { unique: true });

// Fast lookups: all clubs in a season, or all seasons for a club
clubSeasonSchema.index({ season: 1 });
clubSeasonSchema.index({ club: 1 });

module.exports = mongoose.model("ClubSeason", clubSeasonSchema);
