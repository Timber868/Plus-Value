const Person = require("../models/Person");
const Owner = require("../models/Owner");

/**
 * Upserts a single owner: the Person doc keyed by name (owners have no
 * dataset natural key; the curated seed file keeps names unique), then the
 * Owner doc keyed by the person ref. Optional fields are only written when
 * present, so trimming one from the seed never clears it in Mongo.
 *
 * @param {{ name: string, birthDate: Date, nationality: string,
 *   netWorth?: number, financialSustainabilityScore?: number }} doc Document
 *   produced by `toOwnerDoc`.
 * @returns {Promise<void>}
 */
async function upsertOwner(doc) {
  const person = await Person.findOneAndUpdate(
    { name: doc.name },
    { $set: { birthDate: doc.birthDate, nationality: doc.nationality } },
    { upsert: true, new: true },
  );

  const $set = {};
  if (doc.netWorth !== undefined) $set.netWorth = doc.netWorth;
  if (doc.financialSustainabilityScore !== undefined) {
    $set.financialSustainabilityScore = doc.financialSustainabilityScore;
  }

  await Owner.findOneAndUpdate(
    { person: person._id },
    Object.keys($set).length > 0 ? { $set } : {},
    { upsert: true, new: true },
  );
}

/**
 * Upserts every owner doc sequentially. The seed file is a short curated
 * list, so there is no need for the bulkWrite batching the dataset-backed
 * services use.
 *
 * @param {Array<object>} docs Documents produced by `toOwnerDoc`.
 * @returns {Promise<{ synced: number }>}
 */
async function upsertMany(docs) {
  for (const doc of docs) {
    await upsertOwner(doc);
  }
  return { synced: docs.length };
}

module.exports = { upsertOwner, upsertMany };
