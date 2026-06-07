/**
 * @file Pure transformation from a Transfermarkt season year into the shape of
 * the Season model.
 *
 * Transfermarkt encodes a season as a single start year (e.g. "2025" is the
 * 2025/2026 campaign). We model it with a fixed Aug 1 -> May 31 window and a
 * "<year>/<year+1>" period. The period is derived here rather than relying on
 * the Season `pre("validate")` hook, because the season upsert uses
 * findOneAndUpdate, which bypasses document middleware.
 */

/**
 * Maps a season start year to Season document fields.
 *
 * @param {string|number} year Season start year, e.g. "2025" or 2025.
 * @returns {{ startDate: Date, endDate: Date, period: string }}
 * @throws {Error} When `year` is not a valid integer year.
 */
function toSeason(year) {
  const startYear = Number(year);
  if (!Number.isInteger(startYear)) {
    throw new Error(`Invalid season year: ${year}`);
  }
  const endYear = startYear + 1;

  // Month is 0-indexed: 7 = August, 4 = May.
  const startDate = new Date(Date.UTC(startYear, 7, 1));
  const endDate = new Date(Date.UTC(endYear, 4, 31));

  return { startDate, endDate, period: `${startYear}/${endYear}` };
}

module.exports = { toSeason };
