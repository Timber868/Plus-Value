const mongoose = require("mongoose");

// Mongoose schema for the owners
const ownerSchema = new mongoose.Schema(
  {
    // Each owner is also a Person
    person: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Person",
      required: true,
      unique: true,
    },

    // Estimated net worth but not required as we don't always know
    netWorth: { type: Number, min: 0 },
    financialSustainabilityScore: { type: Number, min: 1, max: 100 },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Owner", ownerSchema);
