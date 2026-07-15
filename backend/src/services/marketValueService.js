const MarketValue = require("../models/MarketValue");

/**
 * MongoDB bulkWrite batch size. Keeps each round trip small so a single
 * malformed document cannot fail an arbitrarily large batch.
 */
const BATCH_SIZE = 500;

/**
 * Builds a single MongoDB `updateOne` operation for the `MarketValue`
 * collection. Upserts on the (player, date) pair — the collection's unique
 * index — and writes the snapshot `value`.
 *
 * @param {{ player: *, date: Date, value: number }} doc
 * @returns {{ updateOne: { filter: object, update: object, upsert: true } }}
 */
function buildUpsertOp(doc) {
  return {
    updateOne: {
      filter: { player: doc.player, date: doc.date },
      update: { $set: { value: doc.value } },
      upsert: true,
    },
  };
}

/**
 * Upserts MarketValue documents in batches of {@link BATCH_SIZE}.
 *
 * Short-circuits for an empty input and uses `{ ordered: false }` so one bad
 * document does not block the rest of the batch.
 *
 * @param {Array<object>} docs Docs with a resolved `player` ObjectId.
 * @returns {Promise<{ upserted: number, modified: number }>}
 */
async function upsertMany(docs) {
  let upserted = 0;
  let modified = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const ops = docs.slice(i, i + BATCH_SIZE).map(buildUpsertOp);
    const result = await MarketValue.bulkWrite(ops, { ordered: false });
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
