// config/database.js — MongoDB connection via Mongoose
// TODO: implement connection logic

const mongoose = require('mongoose');

/**
 * Connects to MongoDB using the MONGO_URI environment variable.
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  // TODO: mongoose.connect(process.env.MONGO_URI, { ... options ... });
  console.log('[db] connectDB placeholder — add mongoose.connect() here');
};

module.exports = connectDB;
