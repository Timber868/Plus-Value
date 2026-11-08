const express = require("express");
const mongoose = require("mongoose");
const { getClubTransferRoi } = require("../services/clubTransferRoiService");
const { getSquadValue, getSquadValueHistory } = require("../services/squadValueService");
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

// GET /api/clubs/:id/seasons/:seasonId/squad-value
router.get("/:id/seasons/:seasonId/squad-value", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid club id" });
  }
  if (!mongoose.isValidObjectId(req.params.seasonId)) {
    return res.status(400).json({ error: "Invalid season id" });
  }

  const squad = await getSquadValue(req.params.id, req.params.seasonId);
  if (!squad) return res.status(404).json({ error: "Club or season not found" });

  res.json(squad);
});

// GET /api/clubs/:id/squad-value/history
router.get("/:id/squad-value/history", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid club id" });
  }

  const history = await getSquadValueHistory(req.params.id);
  if (!history) return res.status(404).json({ error: "Club not found" });

  res.json(history);
});

module.exports = router;
