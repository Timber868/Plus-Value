const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const League = require("../models/League");
const Season = require("../models/Season");
const { readStandings } = require("../etl/readers/standingsReader");
const { toSeason } = require("../etl/mappers/seasonMapper");
const { toClubDoc, isValidClubDoc } = require("../etl/mappers/clubMapper");
const { toClubSeasonDoc } = require("../etl/mappers/clubSeasonMapper");
const clubService = require("../services/clubService");
const clubSeasonService = require("../services/clubSeasonService");

/**
 * Orchestrates the clubs sync for one season of a single competition: resolve
 * League → resolve the already-synced Season → read standings → upsert Clubs →
 * upsert ClubSeason rows (points + standing).
 *
 * Assumes a Mongo connection is already open, and that the League (see
 * `syncLeagues`) and Season (see `syncSeasons`) have already been synced. The
 * set of clubs comes from the clubs that actually played that season+competition
 * (the standings query), so it reflects "the clubs in the league at the time"
 * rather than the current `domestic_competition_id`. Standing is assigned from
 * the reader's order (points DESC, goal diff DESC).
 *
 * @param {object} options
 * @param {string|number} options.season Season start year, e.g. "2025".
 * @param {string} options.competitionId Competition code, e.g. "FR1".
 * @param {string} [options.dbPath] Optional DuckDB path override (tests point
 *   this at a fixture).
 * @returns {Promise<{
 *   inspected: number,
 *   skipped: number,
 *   clubsSynced: number,
 *   clubsUpserted: number,
 *   clubsModified: number,
 *   clubSeasonsSynced: number,
 *   clubSeasonsUpserted: number,
 *   clubSeasonsModified: number
 * }>}
 */
async function run({ season, competitionId, dbPath } = {}) {
  const league = await League.findOne({ competitionId });
  if (!league) {
    throw new Error(
      `League not found for competitionId "${competitionId}" — run syncLeagues first.`,
    );
  }

  const { period } = toSeason(season);
  const seasonDoc = await Season.findOne({ league: league._id, period });
  if (!seasonDoc) {
    throw new Error(
      `Season not found for "${period}" — run syncSeasons first.`,
    );
  }

  const rows = await readStandings({ season, competitionId, dbPath });

  // Build club docs in standings order; standing is the 1-indexed position
  // among the valid rows.
  const entries = [];
  let skipped = 0;
  for (const row of rows) {
    const doc = toClubDoc(row, league.country);
    if (!isValidClubDoc(doc)) {
      skipped++;
      continue;
    }
    entries.push({ doc, points: row.points, standing: entries.length + 1 });
  }

  const clubDocs = entries.map((e) => e.doc);
  const clubStats = await clubService.upsertMany(clubDocs);

  // Resolve DuckDB club ids to Mongo _ids so ClubSeason rows can link them.
  const idMap = await clubService.findIdsByClubId(clubDocs.map((d) => d.clubId));

  const clubSeasonDocs = [];
  for (const entry of entries) {
    const club = idMap.get(entry.doc.clubId);
    if (!club) continue;
    clubSeasonDocs.push(
      toClubSeasonDoc({
        club,
        season: seasonDoc._id,
        points: entry.points,
        standing: entry.standing,
      }),
    );
  }
  const clubSeasonStats = await clubSeasonService.upsertMany(clubSeasonDocs);

  return {
    inspected: rows.length,
    skipped,
    clubsSynced: clubDocs.length,
    clubsUpserted: clubStats.upserted,
    clubsModified: clubStats.modified,
    clubSeasonsSynced: clubSeasonDocs.length,
    clubSeasonsUpserted: clubSeasonStats.upserted,
    clubSeasonsModified: clubSeasonStats.modified,
  };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/syncClubs.js`), never when it is `require`'d as a module.
// Excluded from coverage because the body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  const season = process.env.SEASON || "2025";
  const competitionId = process.env.COMPETITION_ID || "FR1";

  connectDB()
    .then(() => run({ season, competitionId }))
    .then((stats) => console.log("Clubs sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
