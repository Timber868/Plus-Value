const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const { toOwnerDoc, isValidOwnerDoc } = require("../etl/mappers/ownerMapper");
const ownerService = require("../services/ownerService");

/** Default location of the curated owners seed file. */
const DEFAULT_SEED_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "seeds",
  "owners.json",
);

/**
 * Orchestrates the owners sync: read the curated seed file → shape entries
 * into Person + Owner fields → upsert via the owner service. Entries missing
 * a required Person field or with out-of-bounds optional fields are skipped
 * and counted.
 *
 * Assumes a Mongo connection is already open. Unlike the other sync jobs the
 * source is not the DuckDB snapshot: club owners are not in the Transfermarkt
 * datasets, so the list is maintained by hand in
 * `backend/data/seeds/owners.json`.
 *
 * @param {object} [options]
 * @param {string} [options.seedPath] Optional seed file override (tests point
 *   this at a temp file).
 * @returns {Promise<{
 *   inspected: number,
 *   skipped: number,
 *   ownersSynced: number
 * }>}
 */
async function run({ seedPath = DEFAULT_SEED_PATH } = {}) {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Owners seed file not found at "${seedPath}".`);
  }
  const entries = JSON.parse(fs.readFileSync(seedPath, "utf8"));

  const docs = [];
  let skipped = 0;
  for (const entry of entries) {
    const doc = toOwnerDoc(entry);
    if (!isValidOwnerDoc(doc)) {
      skipped++;
      continue;
    }
    docs.push(doc);
  }

  const stats = await ownerService.upsertMany(docs);

  return {
    inspected: entries.length,
    skipped,
    ownersSynced: stats.synced,
  };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/syncOwners.js`), never when it is `require`'d as a module.
// Excluded from coverage because the body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  connectDB()
    .then(() => run())
    .then((stats) => console.log("Owners sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run, DEFAULT_SEED_PATH };
