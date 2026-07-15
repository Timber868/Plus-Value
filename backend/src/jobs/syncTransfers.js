const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const League = require("../models/League");
const Season = require("../models/Season");
const { readTransfers } = require("../etl/readers/transfersReader");
const {
  toTransferDoc,
  isValidTransferDoc,
  toExternalClubDoc,
} = require("../etl/mappers/transferMapper");
const playerService = require("../services/playerService");
const clubService = require("../services/clubService");
const transferService = require("../services/transferService");

/**
 * Orchestrates the transfers sync: read every transfer from the DuckDB
 * snapshot → shape rows into Transfer fields → resolve the season (by
 * expanded period against the league's synced seasons), the player, and both
 * clubs → upsert via the transfer service.
 *
 * Assumes a Mongo connection is already open and that leagues, seasons and
 * players have already been synced. Transfers referencing an unsynced season
 * or an unknown player are skipped and counted. Transfer partners missing
 * from the clubs collection (foreign buyers/sellers) are created as external
 * clubs (insert-only, so synced Ligue 1 clubs are never touched).
 *
 * @param {object} [options]
 * @param {string} [options.competitionId] League whose seasons anchor the
 *   transfers (default "FR1").
 * @param {string} [options.dbPath] Optional DuckDB path override (tests point
 *   this at a fixture).
 * @returns {Promise<{
 *   inspected: number,
 *   skippedInvalid: number,
 *   skippedUnresolvedSeason: number,
 *   skippedUnresolvedPlayer: number,
 *   externalClubsUpserted: number,
 *   transfersSynced: number,
 *   transfersUpserted: number,
 *   transfersModified: number
 * }>}
 */
async function run({ competitionId = "FR1", dbPath } = {}) {
  const league = await League.findOne({ competitionId });
  if (!league) {
    throw new Error(
      `League not found for competitionId "${competitionId}" — run syncLeagues first.`,
    );
  }

  const seasons = await Season.find(
    { league: league._id },
    { period: 1 },
  ).lean();
  const seasonByPeriod = new Map(seasons.map((s) => [s.period, s._id]));

  const rows = await readTransfers({ dbPath });

  // Shape + validate, then drop rows whose season was never synced.
  const candidates = [];
  let skippedInvalid = 0;
  let skippedUnresolvedSeason = 0;
  for (const row of rows) {
    const doc = toTransferDoc(row);
    if (!isValidTransferDoc(doc)) {
      skippedInvalid++;
      continue;
    }
    const season = seasonByPeriod.get(doc.seasonPeriod);
    if (!season) {
      skippedUnresolvedSeason++;
      continue;
    }
    candidates.push({ doc, season });
  }

  // Resolve players; transfers of players absent from Mongo are skipped.
  const distinctPlayerIds = [
    ...new Set(candidates.map((c) => c.doc.playerId)),
  ];
  const playerIdMap = await playerService.findIdsByPlayerId(distinctPlayerIds);

  const resolved = [];
  let skippedUnresolvedPlayer = 0;
  for (const candidate of candidates) {
    const player = playerIdMap.get(candidate.doc.playerId);
    if (!player) {
      skippedUnresolvedPlayer++;
      continue;
    }
    resolved.push({ ...candidate, player });
  }

  // Resolve clubs; unknown transfer partners are created as external clubs
  // (insert-only) and then resolved again.
  const clubNameById = new Map();
  for (const { doc } of resolved) {
    clubNameById.set(doc.buyerClubId, doc.buyerName);
    if (doc.sellerClubId) clubNameById.set(doc.sellerClubId, doc.sellerName);
  }
  const clubIdMap = await clubService.findIdsByClubId([...clubNameById.keys()]);

  const missing = [...clubNameById.keys()].filter((id) => !clubIdMap.has(id));
  let externalClubsUpserted = 0;
  if (missing.length > 0) {
    const externalDocs = missing.map((id) =>
      toExternalClubDoc(id, clubNameById.get(id)),
    );
    const externalStats = await clubService.upsertExternalMany(externalDocs);
    externalClubsUpserted = externalStats.upserted;

    const createdIdMap = await clubService.findIdsByClubId(missing);
    for (const [clubId, _id] of createdIdMap) {
      clubIdMap.set(clubId, _id);
    }
  }

  const docs = resolved.map(({ doc, season, player }) => ({
    player,
    buyer: clubIdMap.get(doc.buyerClubId),
    seller: doc.sellerClubId ? clubIdMap.get(doc.sellerClubId) : undefined,
    season,
    date: doc.date,
    price: doc.price,
    window: doc.window,
  }));
  const stats = await transferService.upsertMany(docs);

  return {
    inspected: rows.length,
    skippedInvalid,
    skippedUnresolvedSeason,
    skippedUnresolvedPlayer,
    externalClubsUpserted,
    transfersSynced: docs.length,
    transfersUpserted: stats.upserted,
    transfersModified: stats.modified,
  };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/syncTransfers.js`), never when it is `require`'d as a
// module. Excluded from coverage because the body is pure environment
// plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  const competitionId = process.env.COMPETITION_ID || "FR1";

  connectDB()
    .then(() => run({ competitionId }))
    .then((stats) => console.log("Transfers sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
