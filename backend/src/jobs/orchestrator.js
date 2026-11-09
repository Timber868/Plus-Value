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

/**
 * Refreshes several competitions in one go (for example FR1, FR2 and FR3):
 * one dataset download and one league sync, then the seasons and clubs of
 * each competition, then the global players and market values, then the
 * transfers of each competition. Used by the data refresh workflow
 * (.github/workflows/refresh-data.yml).
 *
 * Without `season`, routine runs sync each competition's latest season in
 * the dataset, so nothing needs updating when a new season starts. A
 * competition with no season in the dataset is skipped and reported.
 *
 * @param {object} options
 * @param {string[]} options.competitionIds e.g. ["FR1", "FR2", "FR3"]
 * @param {string|number|null} [options.season] Season start year; latest when omitted
 * @param {boolean} [options.allSeasons=false] Backfill every season of each competition
 */
async function runAll({ competitionIds, season = null, allSeasons = false }) {
  if (!competitionIds || competitionIds.length === 0) throw new Error("No competition to refresh");
  const dataset = await downloadDataset();
  const leagues = await syncLeagues.run();

  const competitions = [];
  for (const competitionId of competitionIds) {
    const available = await readSeasons({ competitionId });
    if (available.length === 0) {
      competitions.push({ competitionId, skipped: "no season in the dataset", results: [] });
      continue;
    }
    const years = allSeasons ? available : [season ? String(season) : available[available.length - 1]];
    const results = [];
    for (const year of years) {
      const seasonStats = await syncSeasons.run({ season: year, competitionId });
      const clubStats = await syncClubs.run({ season: year, competitionId });
      results.push({ season: year, seasonStats, clubStats });
    }
    competitions.push({ competitionId, results });
  }

  const players = await syncPlayers.run();
  const marketValues = await syncMarketValues.run();
  const transfers = {};
  for (const c of competitions) {
    if (!c.skipped) transfers[c.competitionId] = await syncTransfers.run({ competitionId: c.competitionId });
  }

  return { dataset, leagues, competitions, players, marketValues, transfers };
}

/**
 * Competitions named by the environment: COMPETITION_IDS ("FR1,FR2,FR3"),
 * else COMPETITION_ID, else FR1.
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]}
 */
function competitionsFromEnv(env) {
  const raw = env.COMPETITION_IDS || env.COMPETITION_ID || "FR1";
  return raw
    .split(",")
    .map((id) => id.trim().toUpperCase())
    .filter(Boolean);
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/orchestrator.js`), never when it is `require`'d as a module.
// Excluded from coverage because the body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  // SEASON is optional: each competition's latest season by default.
  const season = process.env.SEASON || null;
  const competitionIds = competitionsFromEnv(process.env);
  // Off by default; set SYNC_ALL_SEASONS=true to backfill every season each
  // competition has data for (the refresh workflow does on every update).
  const allSeasons = process.env.SYNC_ALL_SEASONS === "true";

  connectDB()
    .then(() => runAll({ competitionIds, season, allSeasons }))
    .then((stats) => console.log("Full sync complete:", JSON.stringify(stats, null, 2)))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run, runAll, competitionsFromEnv };
