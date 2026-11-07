const express = require("express");
const { parseSearchParams, searchPlayers } = require("../services/playerSearchService");

// Player endpoints, mounted at /api/players
const router = express.Router();

// GET /api/players?q=<name>&club=<clubId>&limit=<n>
router.get("/", async (req, res) => {
  const params = parseSearchParams(req.query);
  if (params.error) return res.status(400).json({ error: params.error });

  const results = await searchPlayers(params);
  res.json({ results });
});

module.exports = router;
