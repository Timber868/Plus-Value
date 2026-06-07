const mongoose = require("mongoose");

// Mongoose schema for the clubs
const clubSchema = new mongoose.Schema(
  {
    // Natural key from the Transfermarkt dataset (e.g. "10004"). Used as the
    // upsert key when syncing clubs from DuckDB and to link ClubSeason rows.
    clubId: { type: String, required: true, unique: true, trim: true },

    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },

    // When the club was founded (optional: the DuckDB clubs table has no
    // founding date, so this is populated manually when known)
    creationDate: { type: Date },

    // Financial health score (1–100 when set)
    financialScore: { type: Number, min: 1, max: 100 },

    // When financial_score was last updated
    lastUpdatedScore: { type: Date },

    // True if the club is outside the modeled system (e.g. transfer partner not fully tracked)
    isExternal: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
);

// Export the Club model
module.exports = mongoose.model("Club", clubSchema);
