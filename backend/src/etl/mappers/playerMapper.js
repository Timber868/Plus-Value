/**
 * @file Pure transformations from a players reader row into the fields the
 * player service persists (Person: name/birthDate/nationality, Player:
 * playerId). The reader renders birth dates as 'YYYY-MM-DD' strings, so the
 * only real work is the Date conversion; validation gates out the source rows
 * missing a field the Person schema requires.
 */

/**
 * Shapes a reader row into the doc consumed by `playerService.upsertMany`.
 *
 * @param {{ playerId: string, name: string|null, birthDate: string|null,
 *   nationality: string|null }} row Row from the players reader.
 * @returns {{ playerId: string, name: string|null, birthDate: Date|null,
 *   nationality: string|null }}
 */
function toPlayerDoc(row) {
  return {
    playerId: row.playerId,
    name: row.name,
    // 'YYYY-MM-DD' parses as UTC midnight; null stays null (caught by
    // validation below) rather than becoming the Unix epoch.
    birthDate: row.birthDate ? new Date(row.birthDate) : null,
    nationality: row.nationality,
  };
}

/**
 * Returns `true` when every field required by the Person schema (and the
 * Player unique key) is present. Empty strings are treated as invalid.
 *
 * @param {object} doc Result of {@link toPlayerDoc}.
 * @returns {boolean}
 */
function isValidPlayerDoc(doc) {
  return Boolean(doc.playerId && doc.name && doc.birthDate && doc.nationality);
}

module.exports = { toPlayerDoc, isValidPlayerDoc };
