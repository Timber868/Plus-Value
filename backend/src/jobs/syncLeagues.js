const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const { readCompetitions } = require("../etl/readers/competitionsReader");
const {
  toLeagueDoc,
  isValidLeagueDoc,
} = require("../etl/mappers/leagueMapper");
const leagueService = require("../services/leagueService");

/**
 * Orchestrates one league sync: read from DuckDB → map + validate rows →
 * upsert into Mongo.
 *
 * Assumes a Mongo connection is already open so it is safe to call from a
 * controller, another job, or a test without re-connecting.
 *
 * @param {{ dbPath?: string }} [options] Optional DuckDB path override (used
 *   by integration tests to point at a fixture).
 * @returns {Promise<{
 *   inspected: number,   // rows read from DuckDB
 *   skipped: number,     // rows missing required fields
 *   synced: number,      // rows sent to Mongo
 *   upserted: number,    // new documents created
 *   modified: number     // existing documents updated
 * }>}
 */
async function run({ dbPath } = {}) {
  const rows = await readCompetitions(dbPath);

  const docs = [];
  let skipped = 0;
  for (const row of rows) {
    const doc = toLeagueDoc(row);
    if (!isValidLeagueDoc(doc)) {
      skipped++;
      continue;
    }
    docs.push(doc);
  }

  const { upserted, modified } = await leagueService.upsertMany(docs);

  return {
    inspected: rows.length,
    skipped,
    synced: docs.length,
    upserted,
    modified,
  };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/syncLeagues.js`), never when it is `require`'d as a module.
// Excluded from coverage because the body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  connectDB()
    .then(() => run())
    .then((stats) => console.log("League sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
