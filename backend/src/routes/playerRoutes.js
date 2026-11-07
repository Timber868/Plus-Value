const express = require("express");
const mongoose = require("mongoose");
const { parseSearchParams, searchPlayers } = require("../services/playerSearchService");
const { getPlayerProfile } = require("../services/playerProfileService");

// Player endpoints, mounted at /api/players
const router = express.Router();

// GET /api/players?q=<name>&club=<clubId>&limit=<n>
router.get("/", async (req, res) => {
  const params = parseSearchParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });

  const results = await searchPlayers(params);
  res.json({ results });
});

// GET /api/players/:id
router.get("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid player id" });
  }

  const profile = await getPlayerProfile(req.params.id);
  if (!profile) return res.status(404).json({ error: "Player not found" });

  res.json(profile);
});

module.exports = router;
