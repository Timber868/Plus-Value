const Club = require("../models/Club");

/**
 * MongoDB bulkWrite batch size. Keeps each round trip small so a single
 * malformed document cannot fail an arbitrarily large batch.
 */
const BATCH_SIZE = 500;

/**
 * Builds a single MongoDB `updateOne` operation for the `Club` collection.
 *
 * Always upserts on `clubId`. Only `name` and `country` are written, so
 * manually-curated fields (`financialScore`, `lastUpdatedScore`,
 * `creationDate`) survive subsequent syncs untouched.
 *
 * @param {{ clubId: string, name: string, country: string }} doc
 * @returns {{ updateOne: { filter: object, update: object, upsert: true } }}
 */
function buildUpsertOp(doc) {
  return {
    updateOne: {
      filter: { clubId: doc.clubId },
      update: { $set: { name: doc.name, country: doc.country } },
      upsert: true,
    },
  };
}

/**
 * Upserts club documents in batches of {@link BATCH_SIZE}.
 *
 * Short-circuits for an empty input and uses `{ ordered: false }` so one bad
 * document does not block the rest of the batch.
 *
 * @param {Array<object>} docs Documents produced by `toClubDoc`.
 * @returns {Promise<{ upserted: number, modified: number }>}
 */
async function upsertMany(docs) {
  let upserted = 0;
  let modified = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const ops = docs.slice(i, i + BATCH_SIZE).map(buildUpsertOp);
    const result = await Club.bulkWrite(ops, { ordered: false });
    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
  }

  return { upserted, modified };
}

/**
 * Resolves DuckDB club ids to their Mongo `_id`s, so ClubSeason rows can be
 * linked after the clubs have been upserted.
 *
 * @param {Array<string>} clubIds
 * @returns {Promise<Map<string, import("mongoose").Types.ObjectId>>}
 *   Map of `clubId -> _id` (omits ids that are not present in the collection).
 */
async function findIdsByClubId(clubIds) {
  const map = new Map();
  if (clubIds.length === 0) return map;

  const docs = await Club.find(
    { clubId: { $in: clubIds } },
    { clubId: 1 },
  ).lean();
  for (const doc of docs) {
    map.set(doc.clubId, doc._id);
  }
  return map;
}

module.exports = {
  BATCH_SIZE,
  buildUpsertOp,
  upsertMany,
  findIdsByClubId,
};
