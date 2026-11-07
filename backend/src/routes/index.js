const express = require("express");
const mongoose = require("mongoose");
const playerRoutes = require("./playerRoutes");

// Router for everything under /api. Feature routers are mounted here.
const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

router.use("/players", playerRoutes);

module.exports = router;
