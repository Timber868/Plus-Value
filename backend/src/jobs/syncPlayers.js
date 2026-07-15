const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const { readPlayers } = require("../etl/readers/playersReader");
const { toPlayerDoc, isValidPlayerDoc } = require("../etl/mappers/playerMapper");
const playerService = require("../services/playerService");

/**
 * Orchestrates the players sync: read every player from the DuckDB snapshot →
 * shape rows into Person + Player fields → upsert via the player service.
 * Rows missing any required Person field (name, birth date, nationality) are
 * skipped and counted.
 *
 * Assumes a Mongo connection is already open. Unlike the club/season jobs,
 * players are not scoped to a season or competition — the whole source table
 * is synced so transfers and valuations can always resolve their player.
 *
 * @param {object} [options]
 * @param {string} [options.dbPath] Optional DuckDB path override (tests point
 *   this at a fixture).
 * @returns {Promise<{
 *   inspected: number,
 *   skipped: number,
 *   playersSynced: number,
 *   playersUpserted: number,
 *   personsModified: number
 * }>}
 */
async function run({ dbPath } = {}) {
  const rows = await readPlayers({ dbPath });

  const docs = [];
  let skipped = 0;
  for (const row of rows) {
    const doc = toPlayerDoc(row);
    if (!isValidPlayerDoc(doc)) {
      skipped++;
      continue;
    }
    docs.push(doc);
  }

  const stats = await playerService.upsertMany(docs);

  return {
    inspected: rows.length,
    skipped,
    playersSynced: docs.length,
    playersUpserted: stats.upserted,
    personsModified: stats.modified,
  };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/syncPlayers.js`), never when it is `require`'d as a module.
// Excluded from coverage because the body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  connectDB()
    .then(() => run())
    .then((stats) => console.log("Players sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
