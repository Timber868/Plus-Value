const Player = require("../models/Player");
const MarketValue = require("../models/MarketValue");

// Accepts plain dates (2024-06-01) and full ISO timestamps
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Validates the optional from/to query parameters of the time series endpoint.
 * Both bounds are inclusive.
 *
 * @param {{ from?: string, to?: string }} raw
 * @returns {{ error: string } | { from: Date | null, to: Date | null }}
 */
function parseDateRange(raw) {
  const range = { from: null, to: null };
  for (const key of ["from", "to"]) {
    if (raw[key] === undefined) continue;
    const date = typeof raw[key] === "string" && ISO_DATE.test(raw[key]) ? new Date(raw[key]) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return { error: `Query parameter ${key} must be a date like 2024-06-01` };
    }
    range[key] = date;
  }
  if (range.from && range.to && range.from > range.to) {
    return { error: "Query parameter from must not be after to" };
  }
  return range;
}

/**
 * Returns a player's market value history, oldest first, within an optional
 * date range.
 *
 * @param {string} playerId Mongo id of the Player
 * @param {{ from: Date | null, to: Date | null }} range
 * @returns {Promise<Array<{ date: Date, value: number }> | null>} null when no player has this id
 */
async function getMarketValueSeries(playerId, { from, to }) {
  if (!(await Player.exists({ _id: playerId }))) return null;

  const filter = { player: playerId };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }

  return MarketValue.find(filter, { _id: 0, date: 1, value: 1 }).sort({ date: 1 }).lean();
}

module.exports = { parseDateRange, getMarketValueSeries };
