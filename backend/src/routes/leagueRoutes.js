const express = require("express");
const { listLeagues } = require("../services/selectorService");

// League endpoints, mounted at /api/leagues
const router = express.Router();

// GET /api/leagues
router.get("/", async (req, res) => {
  res.json({ leagues: await listLeagues() });
});

module.exports = router;
