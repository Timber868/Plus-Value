const MarketValue = require("../models/MarketValue");

/**
 * Transfermarkt revalues players about twice a year, so one market window is
 * about six months. A valuation older than one window before the newest
 * valuation in the data means the player was not revalued in the last window
 * (retired, or left the tracked leagues), so it no longer counts as current.
 */
const MARKET_WINDOW_MONTHS = 6;

/**
 * Oldest date a valuation can have and still count as current, given the
 * newest valuation date in the data.
 *
 * @param {Date} newestValuationDate
 * @returns {Date}
 */
function computeCutoff(newestValuationDate) {
  const cutoff = new Date(newestValuationDate);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - MARKET_WINDOW_MONTHS);
  return cutoff;
}

/**
 * Cutoff for the current data, or null when there are no valuations at all.
 * Relative to the newest valuation rather than today, so an older dataset
 * snapshot still shows its players' values.
 *
 * @returns {Promise<Date | null>}
 */
async function getCurrentValueCutoff() {
  const newest = await MarketValue.findOne({}, { date: 1 }).sort({ date: -1 }).lean();
  return newest ? computeCutoff(newest.date) : null;
}

/**
 * Keeps a market value only when it is recent enough to count as current.
 *
 * @param {{ value: number, date: Date } | null} marketValue
 * @param {Date | null} cutoff
 * @returns {{ value: number, date: Date } | null}
 */
function currentOrNull(marketValue, cutoff) {
  if (!marketValue || !cutoff) return null;
  return new Date(marketValue.date) >= cutoff ? marketValue : null;
}

module.exports = { MARKET_WINDOW_MONTHS, computeCutoff, getCurrentValueCutoff, currentOrNull };
