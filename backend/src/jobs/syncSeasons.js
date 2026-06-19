const path = require("path");
const mongoose = require("mongoose");

const connectDB = require("../config/database");
const League = require("../models/League");
const { toSeason } = require("../etl/mappers/seasonMapper");
const seasonService = require("../services/seasonService");

/**
 * Orchestrates one season sync for a single competition: resolve League →
 * upsert Season.
 *
 * Assumes a Mongo connection is already open, and that the competition's
 * League has already been synced (see `syncLeagues`). Clubs and ClubSeason
 * rows are handled separately by `syncClubs`, which must run after this.
 *
 * @param {object} options
 * @param {string|number} options.season Season start year, e.g. "2025".
 * @param {string} options.competitionId Competition code, e.g. "FR1".
 * @returns {Promise<{ period: string }>}
 */
async function run({ season, competitionId } = {}) {
  const league = await League.findOne({ competitionId });
  if (!league) {
    throw new Error(
      `League not found for competitionId "${competitionId}" — run syncLeagues first.`,
    );
  }

  const { startDate, endDate, period } = toSeason(season);
  await seasonService.upsertSeason({
    league: league._id,
    startDate,
    endDate,
    period,
  });

  return { period };
}

// CLI entry point. Only fires when this file is executed directly
// (`node src/jobs/syncSeasons.js`), never when it is `require`'d as a module.
// Excluded from coverage because the body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({
    path: path.join(__dirname, "..", "..", ".env"),
  });

  const season = process.env.SEASON || "2025";
  const competitionId = process.env.COMPETITION_ID || "FR1";

  connectDB()
    .then(() => run({ season, competitionId }))
    .then((stats) => console.log("Season sync complete:", stats))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}

module.exports = { run };
