/**
 * @file Pure transformations from a valuations reader row into the shape of
 * the MarketValue model. The player is still identified by its DuckDB
 * `playerId` here; the job resolves it to a Mongo `_id` before handing docs
 * to the service.
 */

/**
 * Shapes a reader row into an intermediate MarketValue doc.
 *
 * @param {{ playerId: string, date: string, value: number }} row Row from the
 *   valuations reader.
 * @returns {{ playerId: string, date: Date, value: number }}
 */
function toMarketValueDoc(row) {
  return {
    playerId: row.playerId,
    // 'YYYY-MM-DD' parses as UTC midnight.
    date: new Date(row.date),
    value: row.value,
  };
}

/**
 * Returns `true` when the doc satisfies the MarketValue schema: a player key,
 * a date, and a non-negative numeric value (zero is legal).
 *
 * @param {object} doc Result of {@link toMarketValueDoc}.
 * @returns {boolean}
 */
function isValidMarketValueDoc(doc) {
  return Boolean(
    doc.playerId &&
      doc.date &&
      typeof doc.value === "number" &&
      doc.value >= 0,
  );
}

module.exports = { toMarketValueDoc, isValidMarketValueDoc };
