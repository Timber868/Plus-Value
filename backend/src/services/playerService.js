const Player = require("../models/Player");
const Person = require("../models/Person");

/**
 * Batch size for the per-batch lookup + writes. Keeps each round trip small
 * so a single malformed document cannot fail an arbitrarily large batch.
 */
const BATCH_SIZE = 500;

/**
 * Upserts player documents (and their linked Person docs) in batches of
 * {@link BATCH_SIZE}.
 *
 * A Player has no self-contained natural document: its identity fields live
 * on the linked Person. So instead of a single bulkWrite, each batch is split
 * on whether the `playerId` already exists:
 *
 * - unseen playerIds: insert the Person docs, then insert Player docs
 *   pointing at them (counted as `upserted`);
 * - known playerIds: refresh the linked Person's name/birthDate/nationality
 *   (counted as `modified` when Mongo reports a change) and the Player's
 *   position and sub-position.
 *
 * @param {Array<{ playerId: string, name: string, birthDate: Date,
 *   nationality: string, position?: string|null, subPosition?: string|null }>} docs
 *   Documents produced by `toPlayerDoc`.
 * @returns {Promise<{ upserted: number, modified: number }>}
 */
async function upsertMany(docs) {
  let upserted = 0;
  let modified = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);

    const existing = await Player.find(
      { playerId: { $in: batch.map((d) => d.playerId) } },
      { playerId: 1, person: 1 },
    ).lean();
    const personByPlayerId = new Map(
      existing.map((p) => [p.playerId, p.person]),
    );

    const newDocs = batch.filter((d) => !personByPlayerId.has(d.playerId));
    const knownDocs = batch.filter((d) => personByPlayerId.has(d.playerId));

    if (newDocs.length > 0) {
      const persons = await Person.insertMany(
        newDocs.map((d) => ({
          name: d.name,
          birthDate: d.birthDate,
          nationality: d.nationality,
        })),
      );
      await Player.insertMany(
        newDocs.map((d, idx) => ({
          playerId: d.playerId,
          person: persons[idx]._id,
          position: d.position ?? null,
          subPosition: d.subPosition ?? null,
          contractExpiresAt: d.contractExpiresAt ?? null,
        })),
      );
      upserted += newDocs.length;
    }

    if (knownDocs.length > 0) {
      const ops = knownDocs.map((d) => ({
        updateOne: {
          filter: { _id: personByPlayerId.get(d.playerId) },
          update: {
            $set: {
              name: d.name,
              birthDate: d.birthDate,
              nationality: d.nationality,
            },
          },
        },
      }));
      const result = await Person.bulkWrite(ops, { ordered: false });
      modified += result.modifiedCount || 0;

      await Player.bulkWrite(
        knownDocs.map((d) => ({
          updateOne: {
            filter: { playerId: d.playerId },
            update: {
              $set: { position: d.position ?? null, subPosition: d.subPosition ?? null, contractExpiresAt: d.contractExpiresAt ?? null },
            },
          },
        })),
        { ordered: false },
      );
    }
  }

  return { upserted, modified };
}

/**
 * Resolves DuckDB player ids to their Mongo `_id`s, so MarketValue and
 * Transfer docs can be linked after the players have been synced.
 *
 * @param {Array<string>} playerIds
 * @returns {Promise<Map<string, import("mongoose").Types.ObjectId>>}
 *   Map of `playerId -> _id` (omits ids that are not present in the
 *   collection).
 */
async function findIdsByPlayerId(playerIds) {
  const map = new Map();
  if (playerIds.length === 0) return map;

  const docs = await Player.find(
    { playerId: { $in: playerIds } },
    { playerId: 1 },
  ).lean();
  for (const doc of docs) {
    map.set(doc.playerId, doc._id);
  }
  return map;
}

module.exports = {
  BATCH_SIZE,
  upsertMany,
  findIdsByPlayerId,
};
