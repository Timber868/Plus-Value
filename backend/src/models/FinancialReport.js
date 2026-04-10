const mongoose = require("mongoose");

// One financial report per (club, season). Add line-item fields later when defined.
const financialReportSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    season: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Season",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// At most one financial report document per club per season
financialReportSchema.index({ club: 1, season: 1 }, { unique: true });

module.exports = mongoose.model("FinancialReport", financialReportSchema);
