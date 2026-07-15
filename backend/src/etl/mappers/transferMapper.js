/**
 * @file Pure transformations from a transfers reader row toward the Transfer
 * model. Players, clubs and seasons are still identified by their natural
 * keys here; the job resolves them to Mongo `_id`s before handing docs to the
 * service.
 */

/**
 * Two-digit years at or above this pivot are read as 19xx; below it as 20xx.
 * The dataset's oldest transfer seasons are in the 1960s, and football data
 * cannot pre-date 1900, so a fixed pivot is safe.
 */
const CENTURY_PIVOT = 60;

/**
 * Expands a Transfermarkt "YY/YY" transfer season into the "YYYY/YYYY"
 * period format used by the Season model (see its pre-validate hook).
 *
 * The end year always follows the start year, so only the start year needs
 * the century pivot: "99/00" → "1999/2000", "24/25" → "2024/2025".
 *
 * @param {string} season e.g. "24/25".
 * @returns {string} e.g. "2024/2025".
 */
function toSeasonPeriod(season) {
  const startYY = Number(season.slice(0, 2));
  const startYear = startYY >= CENTURY_PIVOT ? 1900 + startYY : 2000 + startYY;
  return `${startYear}/${startYear + 1}`;
}

/**
 * Derives the transfer window from the transfer date's month: June–September
 * is the summer window, December–February the winter window. Dates outside
 * both (contract oddities, administrative moves) yield `undefined` so the
 * optional `window` field is simply not set.
 *
 * @param {Date} date
 * @returns {("summer"|"winter"|undefined)}
 */
function toWindow(date) {
  const month = date.getUTCMonth() + 1;
  if (month >= 6 && month <= 9) return "summer";
  if (month === 12 || month <= 2) return "winter";
  return undefined;
}

/**
 * Shapes a reader row into an intermediate transfer doc. The fee becomes
 * `price` (undefined when the source has none — free or undisclosed), and the
 * window is derived from the date.
 *
 * @param {{ playerId: string, date: string, season: string,
 *   sellerClubId: string|null, buyerClubId: string|null,
 *   sellerName: string|null, buyerName: string|null,
 *   fee: number|null }} row Row from the transfers reader.
 * @returns {{ playerId: string, buyerClubId: string|null,
 *   sellerClubId: string|null, buyerName: string|null,
 *   sellerName: string|null, seasonPeriod: string, date: Date,
 *   price: number|undefined, window: string|undefined }}
 */
function toTransferDoc(row) {
  const date = new Date(row.date);
  return {
    playerId: row.playerId,
    buyerClubId: row.buyerClubId,
    sellerClubId: row.sellerClubId,
    buyerName: row.buyerName,
    sellerName: row.sellerName,
    seasonPeriod: toSeasonPeriod(row.season),
    date,
    price: row.fee === null ? undefined : row.fee,
    window: toWindow(date),
  };
}

/**
 * Returns `true` when every field the Transfer schema requires is present:
 * player, buyer, date and a resolvable season period. The seller is optional
 * (free transfers, youth signings).
 *
 * @param {object} doc Result of {@link toTransferDoc}.
 * @returns {boolean}
 */
function isValidTransferDoc(doc) {
  return Boolean(
    doc.playerId && doc.buyerClubId && doc.date && doc.seasonPeriod,
  );
}

/**
 * Builds the minimal Club doc for a transfer partner that is not in Mongo
 * yet. The source has no country for these, hence the "Unknown" placeholder;
 * the service marks them `isExternal` on insert.
 *
 * @param {string} clubId
 * @param {string} name
 * @returns {{ clubId: string, name: string, country: string }}
 */
function toExternalClubDoc(clubId, name) {
  return { clubId, name, country: "Unknown" };
}

module.exports = {
  toSeasonPeriod,
  toWindow,
  toTransferDoc,
  isValidTransferDoc,
  toExternalClubDoc,
};
