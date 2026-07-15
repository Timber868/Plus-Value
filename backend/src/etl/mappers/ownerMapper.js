/**
 * @file Pure transformations from an owners seed entry into the Person +
 * Owner fields the service persists. Owners have no Transfermarkt source:
 * entries are hand-curated in backend/data/seeds/owners.json, so validation
 * also guards the optional fields (netWorth >= 0, score 1-100) that a synced
 * dataset would normally guarantee.
 */

/**
 * Shapes a seed entry into the doc consumed by `ownerService.upsertMany`.
 *
 * @param {{ name: string, birthDate: string, nationality: string,
 *   netWorth?: number, financialSustainabilityScore?: number }} entry Entry
 *   from the owners seed file.
 * @returns {{ name: string, birthDate: Date|null, nationality: string,
 *   netWorth: number|undefined,
 *   financialSustainabilityScore: number|undefined }}
 */
function toOwnerDoc(entry) {
  return {
    name: entry.name,
    // 'YYYY-MM-DD' parses as UTC midnight; a missing date stays null (caught
    // by validation below) rather than becoming the Unix epoch.
    birthDate: entry.birthDate ? new Date(entry.birthDate) : null,
    nationality: entry.nationality,
    netWorth: entry.netWorth,
    financialSustainabilityScore: entry.financialSustainabilityScore,
  };
}

/**
 * Returns `true` when the required Person fields are present and any provided
 * optional Owner field is within its schema bounds (netWorth >= 0, score
 * 1-100). Empty strings are treated as invalid.
 *
 * @param {object} doc Result of {@link toOwnerDoc}.
 * @returns {boolean}
 */
function isValidOwnerDoc(doc) {
  if (!doc.name || !doc.birthDate || !doc.nationality) return false;
  if (doc.netWorth !== undefined) {
    if (typeof doc.netWorth !== "number" || doc.netWorth < 0) return false;
  }
  if (doc.financialSustainabilityScore !== undefined) {
    const score = doc.financialSustainabilityScore;
    if (typeof score !== "number" || score < 1 || score > 100) return false;
  }
  return true;
}

module.exports = { toOwnerDoc, isValidOwnerDoc };
