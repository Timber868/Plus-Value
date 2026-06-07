const ClubSeason = require("../models/ClubSeason");

/**
 * MongoDB bulkWrite batch size. Keeps each round trip small so a single
 * malformed document cannot fail an arbitrarily large batch.
 */
const BATCH_SIZE = 500;

/**
 * Builds a single MongoDB `updateOne` operation for the `ClubSeason`
 * collection. Upserts on the (club, season) pair and writes the seasonal
 * `points` and `standing`.
 *
 * @param {{ club: *, season: *, points: number, standing: number }} doc
 * @returns {{ updateOne: { filter: object, update: object, upsert: true } }}
 */
function buildUpsertOp(doc) {
  return {
    updateOne: {
      filter: { club: doc.club, season: doc.season },
      update: { $set: { points: doc.points, standing: doc.standing } },
      upsert: true,
    },
  };
}

/**
 * Upserts ClubSeason documents in batches of {@link BATCH_SIZE}.
 *
 * Short-circuits for an empty input and uses `{ ordered: false }` so one bad
 * document does not block the rest of the batch.
 *
 * @param {Array<object>} docs Documents produced by `toClubSeasonDoc`.
 * @returns {Promise<{ upserted: number, modified: number }>}
 */
async function upsertMany(docs) {
  let upserted = 0;
  let modified = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const ops = docs.slice(i, i + BATCH_SIZE).map(buildUpsertOp);
    const result = await ClubSeason.bulkWrite(ops, { ordered: false });
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
