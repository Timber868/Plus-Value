const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const {
  readPlayerValuations,
} = require("../etl/readers/playerValuationsReader");
const {
  toMarketValueDoc,
  isValidMarketValueDoc,
} = require("../etl/mappers/marketValueMapper");
const playerService = require("../services/playerService");
const marketValueService = require("../services/marketValueService");

/**
 * Orchestrates the market values sync: read every valuation snapshot from the
 * DuckDB snapshot → shape rows into MarketValue fields → resolve each
 * `playerId` to the Mongo Player `_id` → upsert via the market value service.
 *
 * Assumes a Mongo connection is already open and that players have already
 * been synced (see `syncPlayers`); snapshots whose player is not in Mongo
 * (e.g. skipped during the players sync) are skipped and counted, as are rows
 * failing schema validation (negative values).
 *
 * @param {object} [options]
 * @param {string} [options.dbPath] Optional DuckDB path override (tests point
 *   this at a fixture).
 * @returns {Promise<{
 *   inspected: number,
 *   skippedInvalid: number,
 *   skippedUnresolvedPlayer: number,
 *   marketValuesSynced: number,
 *   marketValuesUpserted: number,
 *   marketValuesModified: number
 * }>}
 */
async function run({ dbPath } = {}) {
  const rows = await readPlayerValuations({ dbPath });

  const candidates = [];
  let skippedInvalid = 0;
  for (const row of rows) {
    const doc = toMarketValueDoc(row);
    if (!isValidMarketValueDoc(doc)) {
      skippedInvalid++;
      continue;
    }
    candidates.push(doc);
  }

  const distinctPlayerIds = [...new Set(candidates.map((d) => d.playerId))];
  const idMap = await playerService.findIdsByPlayerId(distinctPlayerIds);

  const docs = [];
  let skippedUnresolvedPlayer = 0;
  for (const candidate of candidates) {
    const player = idMap.get(candidate.playerId);
    if (!player) {
      skippedUnresolvedPlayer++;
      continue;
    }
    docs.push({ player, date: candidate.date, value: candidate.value });
  }

  const stats = await marketValueService.upsertMany(docs);

  return {
    inspected: rows.length,
    skippedInvalid,
    skippedUnresolvedPlayer,
    marketValuesSynced: docs.length,
    marketValuesUpserted: stats.upserted,
    marketValuesModified: stats.modified,
  };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/syncMarketValues.js`), never when it is `require`'d as a
// module. Excluded from coverage because the body is pure environment
// plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  connectDB()
    .then(() => run())
    .then((stats) => console.log("Market values sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
