const express = require("express");
const mongoose = require("mongoose");
const playerRoutes = require("./routes/playerRoutes");

// App setup: no database connection or listen here, so tests can import it
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

module.exports = app;
