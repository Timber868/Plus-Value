const express = require("express");
const mongoose = require("mongoose");
const playerRoutes = require("./playerRoutes");
const clubRoutes = require("./clubRoutes");
const seasonRoutes = require("./seasonRoutes");
const leagueRoutes = require("./leagueRoutes");

// Router for everything under /api. Feature routers are mounted here.
const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

router.use("/players", playerRoutes);
router.use("/clubs", clubRoutes);
router.use("/seasons", seasonRoutes);
router.use("/leagues", leagueRoutes);

module.exports = router;
