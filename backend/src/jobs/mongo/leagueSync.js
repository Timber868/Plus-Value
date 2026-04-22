const path = require("path");
const mongoose = require("mongoose");
const { DuckDBInstance } = require("@duckdb/node-api");

const League = require("../../models/League");
const connectDB = require("../../config/database");

// DuckDB snapshot location
const DB_FILENAME = "market-datasets.duckdb";
const DB_DIR =
  process.env.CUSTOM_DATA_DIR || path.join(__dirname, "..", "..", "..", "data");
const DB_PATH = path.join(DB_DIR, DB_FILENAME);

// Mongo bulkWrite batch size, we keep batching for safety.
const BATCH_SIZE = 500;

// Reads the competitions table from the local DuckDB snapshot.
async function readCompetitionsFromDuckDB() {
  const instance = await DuckDBInstance.create(DB_PATH);
  const connection = await instance.connect();
  const reader = await connection.runAndReadAll(
    `SELECT competition_id, name, sub_type, type, country_name, confederation
     FROM competitions`,
  );
  return reader.getRowObjects();
}

// Maps the DuckDB `type` column to our `competitionFormat` enum.
// Transfermarkt uses values like "domestic_league", "domestic_cup",
// "international_cup", "domestic_super_cup", etc.
function toCompetitionFormat(type) {
  if (!type) return "league";
  return type.toLowerCase().includes("cup") ? "cup" : "league";
}

// Tier is present under subtype, if we cant find a matching tier leave it blank
function toTier(subType) {
  // sub_type from DuckDB can be an array, a single string, or null, make sure it ends up being an array
  const items = Array.isArray(subType)
    ? subType
    : subType == null
      ? []
      : [subType];

  const candidates = items.filter(Boolean).map((s) => s.toLowerCase());
  for (const candidate of candidates) {
    if (candidate.includes("first_tier")) return 1;
    if (candidate.includes("second_tier")) return 2;
    if (candidate.includes("third_tier")) return 3;
    if (candidate.includes("fourth_tier")) return 4;
    if (candidate.includes("fifth_tier")) return 5;
  }
  return undefined;
}

// Transforms a raw DuckDB row into the shape expected by the League schema.
function toLeagueDoc(row) {
  return {
    competitionId: row.competition_id,
    name: row.name,
    country: row.country_name,
    confederation: row.confederation,
    tier: toTier(row.sub_type),
    competitionFormat: toCompetitionFormat(row.type),
  };
}

/* Builds a single MongoDB updateOne opertation. It will either insert the document
 * if it doesent exist or update it if it does.
 *
 * This allows us to create a bunch of operation objects and hand them all to bulkwrite in one round trip.
 */
function buildUpsertOp(doc) {
  // europeanSpots is intentionally never touched so manual values in MongoDB are preserved across syncs.
  // List of fields we are setting and their values
  const $set = {
    name: doc.name,
    country: doc.country,
    confederation: doc.confederation,
    competitionFormat: doc.competitionFormat,
  };

  // Doc tier is not mandatory, only insert it if it was found
  if (doc.tier !== undefined) {
    $set.tier = doc.tier;
  }

  return {
    // Update one tells mongoDB tyhe sepeicifc operation to run
    updateOne: {
      // Find the existing doc
      filter: { competitionId: doc.competitionId },

      // Set means only change/insert these fields
      update: { $set },

      // IF the filter matches a doc update it if not insert a new doc
      upsert: true,
    },
  };
}

// Main entrypoint. Assumes a MongoDB connection is already open.
async function syncLeagues() {
  const rows = await readCompetitionsFromDuckDB();

  const docs = [];
  let skipped = 0;
  for (const row of rows) {
    const doc = toLeagueDoc(row);
    // Skip rows missing required fields on the League schema
    if (!doc.competitionId || !doc.name || !doc.country || !doc.confederation) {
      skipped++;
      continue;
    }
    docs.push(doc);
  }

  let upserted = 0;
  let modified = 0;

  // Batch upsert into MongoDB iterate over a batch size each
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    // Retrieve all the operations to be done in mongo
    const ops = docs.slice(i, i + BATCH_SIZE).map(buildUpsertOp);
    const result = await League.bulkWrite(ops, { ordered: false });

    // Update the count for successful pperations
    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
  }

  // Return basic data informing on operation logistics
  return {
    inspected: rows.length,
    skipped,
    synced: docs.length,
    upserted,
    modified,
  };
}

async function main() {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", "..", ".env"),
  });

  // Connect to the database and run the mongoDB sync
  await connectDB();
  try {
    const stats = await syncLeagues();
    console.log("League sync complete:", stats);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  //If this file is run main and print out errors
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  syncLeagues,
  toCompetitionFormat,
  toTier,
  toLeagueDoc,
  buildUpsertOp,
  readCompetitionsFromDuckDB,
};
