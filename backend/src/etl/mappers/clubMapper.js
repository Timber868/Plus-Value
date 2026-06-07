/**
 * @file Pure transformations from a standings reader row into the shape of the
 * Club model. The DuckDB clubs table has no country column, so country is
 * injected by the caller from the linked League. Manual fields
 * (financialScore, lastUpdatedScore) are never produced here so the service
 * can preserve them across syncs.
 */

/**
 * Shapes a reader row into a Club document.
 *
 * @param {{ clubId: string, name: string }} row Row from the standings reader.
 * @param {string} country Country derived from the linked League.
 * @returns {{ clubId: string, name: string, country: string }}
 */
function toClubDoc(row, country) {
  return { clubId: row.clubId, name: row.name, country };
}

/**
 * Returns `true` when every field required by the Club schema (and safe for
 * the unique index) is present. Empty strings are treated as invalid.
 *
 * @param {object} doc Result of {@link toClubDoc}.
 * @returns {boolean}
 */
function isValidClubDoc(doc) {
  return Boolean(doc.clubId && doc.name);
}

module.exports = { toClubDoc, isValidClubDoc };
