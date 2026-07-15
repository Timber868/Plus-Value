const Transfer = require("../models/Transfer");

/**
 * MongoDB bulkWrite batch size. Keeps each round trip small so a single
 * malformed document cannot fail an arbitrarily large batch.
 */
const BATCH_SIZE = 500;

/**
 * Builds a single MongoDB `updateOne` operation for the `Transfer`
 * collection. Upserts on the (player, date, buyer) triple — the closest
 * thing a transfer has to a natural key — and writes the season plus the
 * optional seller/price/window only when present, so absent values never
 * clobber a previously-written field with `undefined`.
 *
 * @param {{ player: *, buyer: *, seller: *|undefined, season: *,
 *   date: Date, price: number|undefined, window: string|undefined }} doc
 * @returns {{ updateOne: { filter: object, update: object, upsert: true } }}
 */
function buildUpsertOp(doc) {
  const $set = { season: doc.season };
  if (doc.seller !== undefined) $set.seller = doc.seller;
  if (doc.price !== undefined) $set.price = doc.price;
  if (doc.window !== undefined) $set.window = doc.window;

  return {
    updateOne: {
      filter: { player: doc.player, date: doc.date, buyer: doc.buyer },
      update: { $set },
      upsert: true,
    },
  };
}

/**
 * Upserts Transfer documents in batches of {@link BATCH_SIZE}.
 *
 * Short-circuits for an empty input and uses `{ ordered: false }` so one bad
 * document does not block the rest of the batch.
 *
 * @param {Array<object>} docs Docs with resolved player/buyer/seller/season
 *   ObjectIds.
 * @returns {Promise<{ upserted: number, modified: number }>}
 */
async function upsertMany(docs) {
  let upserted = 0;
  let modified = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const ops = docs.slice(i, i + BATCH_SIZE).map(buildUpsertOp);
    const result = await Transfer.bulkWrite(ops, { ordered: false });
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
