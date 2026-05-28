const League = require("../models/League");

/**
 * MongoDB bulkWrite batch size. Keeps each round trip small so a single
 * malformed document cannot fail an arbitrarily large batch.
 */
const BATCH_SIZE = 500;

/**
 * Builds a single MongoDB `updateOne` operation for the `League` collection.
 *
 * Always upserts on `competitionId`. The `europeanSpots` field is deliberately
 * never set here so any manual value stored in Mongo survives subsequent
 * syncs. `tier` is only written when defined, for the same reason.
 *
 * @param {object} doc League document produced by `toLeagueDoc`.
 * @returns {{ updateOne: { filter: object, update: object, upsert: true } }}
 *   Operation object suitable for `Model.bulkWrite`.
 */
function buildUpsertOp(doc) {
  const $set = {
    name: doc.name,
    country: doc.country,
    confederation: doc.confederation,
    competitionFormat: doc.competitionFormat,
  };

  if (doc.tier !== undefined) {
    $set.tier = doc.tier;
  }

  return {
    updateOne: {
      filter: { competitionId: doc.competitionId },
      update: { $set },
      upsert: true,
    },
  };
}

/**
 * Upserts league documents in batches of {@link BATCH_SIZE}.
 *
 * Short-circuits for an empty input — never opens a round trip when there is
 * nothing to write. `bulkWrite` is invoked with `{ ordered: false }` so a
 * single failing document does not block the rest of the batch.
 *
 * @param {Array<object>} docs Documents produced by `toLeagueDoc`.
 * @returns {Promise<{ upserted: number, modified: number }>} Totals summed
 *   across all batches.
 */
async function upsertMany(docs) {
  let upserted = 0;
  let modified = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const ops = docs.slice(i, i + BATCH_SIZE).map(buildUpsertOp);
    const result = await League.bulkWrite(ops, { ordered: false });
    // Fields are absent on results from servers that performed no work; treat
    // those as zero rather than NaN.
    upserted += result.upsertedCount || 0;
    modified += result.modifiedCount || 0;
  }

  return { upserted, modified };
}

module.exports = {
  BATCH_SIZE,
  buildUpsertOp,
  upsertMany,
};
