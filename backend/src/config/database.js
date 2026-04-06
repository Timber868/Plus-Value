const mongoose = require("mongoose");

// Function to connect to our database
const connectDB = async () => {
  // Attempt the connection and log the error if there is an issue
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB Atlas");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Expose our database connection function
module.exports = connectDB;
