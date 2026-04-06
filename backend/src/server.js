const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const mongoose = require("mongoose");
const connectDB = require("./config/database");
const playerRoutes = require("./routes/playerRoutes");

// App setup
const app = express();

// Middleware
app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/players", playerRoutes);

// Connect to the database and start the server
const PORT = 3000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  });
});