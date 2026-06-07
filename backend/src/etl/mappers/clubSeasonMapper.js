/**
 * @file Pure transformation that joins a resolved club id and season id with
 * the seasonal points/standing into the shape of the ClubSeason model.
 */

/**
 * Shapes a ClubSeason document.
 *
 * @param {object} input
 * @param {import("mongoose").Types.ObjectId|string} input.club Resolved Club id.
 * @param {import("mongoose").Types.ObjectId|string} input.season Resolved Season id.
 * @param {number} [input.points] Points won in the season (defaults to 0).
 * @param {number} input.standing Final/current table position (1-indexed).
 * @returns {{ club: *, season: *, points: number, standing: number }}
 */
function toClubSeasonDoc({ club, season, points, standing }) {
  return { club, season, points: points ?? 0, standing };
}

module.exports = { toClubSeasonDoc };
