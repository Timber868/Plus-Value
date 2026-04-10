const mongoose = require("mongoose");

// Base entity for ISA hierarchy: Owner and Player link here
const personSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    birthDate: { type: Date, required: true },
    nationality: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Person", personSchema);
