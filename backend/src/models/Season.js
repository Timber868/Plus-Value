const mongoose = require("mongoose");

// Mongoose schema for the seasons
const seasonSchema = new mongoose.Schema(
  {
    // Start and end date of the season
    startDate: { type: Date, required: true, immutable: true },
    endDate: {
      type: Date,
      required: true,
      immutable: true,
      validate: [
        {
          validator: function (v) {
            return this.startDate && v > this.startDate;
          },
          message: "endDate must be after the startDate",
        },
        {
          validator: function (v) {
            // Amount of ms in a year
            const maxMs = 366 * 24 * 60 * 60 * 1000;

            // Check season length it should be less than or equal to one year
            return this.startDate && v - this.startDate <= maxMs;
          },
          message: "season must last no more than one year",
        },
      ],
    },

    // Period is derived in our prehook dont need to be immutable as its only initiated once
    period: { type: String, required: true },

    // A season takes place in a league
    league: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "League",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

/* Pre validate function that allows us to derive periods
 * from the provided start and enddate. The periods will
 * later help confirming periods / league uniqeuness
 */
seasonSchema.pre("validate", function (next) {
  // Only set periods on new inputs
  if (!this.isNew) {
    return next();
  }

  // Make sure both the start date and enddate are there
  if (!this.startDate || !this.endDate) {
    return next(
      new Error("startDate and endDate are required to derive period"),
    );
  }

  // Derive the years to be used
  const startYear = this.startDate.getUTCFullYear();
  const endYear = this.endDate.getUTCFullYear();

  // When the season starts and ends in the same year use just that year
  this.period = startYear === endYear ? `${startYear}` : `${startYear}/${endYear}`;

  // Pre save is done move to the next step
  next();
});

// Make sure only one season per year can exist
seasonSchema.index(
  {
    league: 1,
    period: 1,
  },
  {
    unique: true,
  },
);

// Export the season schema to be usable
module.exports = mongoose.model("Season", seasonSchema);
