const Season = require("../models/Season");

/**
 * Upserts a single season, keyed on its (league, period) pair.
 *
 * Uses `findOneAndUpdate` rather than `save` because document middleware (the
 * `pre("validate")` period hook) does not run on upserts — the period is
 * computed up front by `toSeason` and passed in. `startDate`/`endDate` are
 * immutable on the schema, so they are written via `$setOnInsert` and never
 * rewritten on a re-sync.
 *
 * @param {object} input
 * @param {import("mongoose").Types.ObjectId|string} input.league League id.
 * @param {Date} input.startDate
 * @param {Date} input.endDate
 * @param {string} input.period e.g. "2025/2026".
 * @returns {Promise<object>} The upserted (or existing) Season document.
 */
async function upsertSeason({ league, startDate, endDate, period }) {
  return Season.findOneAndUpdate(
    { league, period },
    { $setOnInsert: { league, startDate, endDate, period } },
    { upsert: true, new: true },
  );
}

module.exports = { upsertSeason };
