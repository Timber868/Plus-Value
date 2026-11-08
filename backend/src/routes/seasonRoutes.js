const express = require("express");
const { listSeasons } = require("../services/selectorService");
const { parseLeague } = require("./leagueParam");

// Season endpoints, mounted at /api/seasons
const router = express.Router();

// GET /api/seasons?league=<competitionId>
router.get("/", async (req, res) => {
  const league = parseLeague(req.query.league);
  if (league === undefined) return res.status(400).json({ error: "Invalid league" });

  res.json({ seasons: await listSeasons({ league }) });
});

module.exports = router;
