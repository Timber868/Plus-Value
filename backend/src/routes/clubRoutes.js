const express = require("express");
const mongoose = require("mongoose");
const { getClubTransferRoi } = require("../services/clubTransferRoiService");
const { listClubs } = require("../services/selectorService");
const { parseLeague } = require("./leagueParam");

// Club endpoints, mounted at /api/clubs
const router = express.Router();

// GET /api/clubs?league=<competitionId>
router.get("/", async (req, res) => {
  const league = parseLeague(req.query.league);
  if (league === undefined) return res.status(400).json({ error: "Invalid league" });

  res.json({ clubs: await listClubs({ league }) });
});

// GET /api/clubs/:id/transfers/roi?season=<seasonId>
router.get("/:id/transfers/roi", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid club id" });
  }
  const seasonId = req.query.season || null;
  if (seasonId !== null && !mongoose.isValidObjectId(seasonId)) {
    return res.status(400).json({ error: "Invalid season" });
  }

  const roi = await getClubTransferRoi(req.params.id, { seasonId });
  if (!roi) return res.status(404).json({ error: "Club not found" });

  res.json(roi);
});

module.exports = router;
