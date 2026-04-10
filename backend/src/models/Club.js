const mongoose = require("mongoose");

// Mongoose schema for the clubs
const clubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },

    // When the club was founded
    creationDate: { type: Date, required: true },

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
