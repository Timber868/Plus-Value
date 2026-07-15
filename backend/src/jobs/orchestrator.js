const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const { downloadDataset } = require("./marketDataset");
const { readSeasons } = require("../etl/readers/seasonsReader");
const syncLeagues = require("./syncLeagues");
const syncSeasons = require("./syncSeasons");
const syncClubs = require("./syncClubs");
const syncPlayers = require("./syncPlayers");
const syncMarketValues = require("./syncMarketValues");
const syncTransfers = require("./syncTransfers");

/**
 * Runs the full refresh pipeline in dependency order: download the DuckDB
 * snapshot, then sync leagues, then — for each season — the season and its
 * clubs + club seasons. Each later stage depends on the collections the earlier
 * ones populate (Season needs League; Clubs/ClubSeason need both).
 *
 * `allSeasons` is the backfill switch. Leave it off for routine refreshes (only
 * the given `season` is synced — the current/latest one). Turn it on for a
 * first run so every season the competition has data for is synced.
 *
 * Assumes a Mongo connection is already open (the CLI entry below opens one).
 *
 * @param {object} options
 * @param {string|number} [options.season] Season start year for routine runs,
 *   e.g. "2025". Ignored when `allSeasons` is true.
 * @param {string} options.competitionId Competition code, e.g. "FR1".
 * @param {boolean} [options.allSeasons=false] When true, backfill every season
 *   the competition has data for instead of just `season`.
 * @returns {Promise<{
 *   dataset: string,
 *   leagues: object,
 *   results: Array<{ season: string, seasonStats: object, clubStats: object }>
 * }>}
 */
async function run({ season, competitionId, allSeasons = false } = {}) {
  const dataset = await downloadDataset();
  const leagues = await syncLeagues.run();

  const seasonYears = allSeasons
    ? await readSeasons({ competitionId })
    : [season];

  const results = [];
  for (const year of seasonYears) {
    const seasonStats = await syncSeasons.run({ season: year, competitionId });
    const clubStats = await syncClubs.run({ season: year, competitionId });
    results.push({ season: year, seasonStats, clubStats });
  }

  // Global stages: players are not season-scoped, market values need the
  // players, and transfers need both the players and the synced seasons.
  const players = await syncPlayers.run();
  const marketValues = await syncMarketValues.run();
  const transfers = await syncTransfers.run({ competitionId });

  return { dataset, leagues, results, players, marketValues, transfers };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/orchestrator.js`), never when it is `require`'d as a module.
// Excluded from coverage because the body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  const season = process.env.SEASON || "2025";
  const competitionId = process.env.COMPETITION_ID || "FR1";
  // Off by default; set SYNC_ALL_SEASONS=true on a first run to backfill every
  // season the competition has data for.
  const allSeasons = process.env.SYNC_ALL_SEASONS === "true";

  connectDB()
    .then(() => run({ season, competitionId, allSeasons }))
    .then((stats) => console.log("Full sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
