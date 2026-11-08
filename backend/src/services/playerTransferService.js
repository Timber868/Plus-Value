const Player = require("../models/Player");
const Transfer = require("../models/Transfer");

/**
 * Shapes a populated club reference for the API, or null when absent.
 *
 * @param {{ _id: *, name: string } | null | undefined} club
 */
function toClub(club) {
  return club ? { id: String(club._id), name: club.name } : null;
}

/**
 * Returns a player's transfers, oldest first, with the clubs involved.
 * The fee is null when the dataset has none (free or undisclosed).
 *
 * @param {string} playerId Mongo id of the Player
 * @returns {Promise<Array<{ date: Date, fromClub: object | null, toClub: object, fee: number | null }> | null>}
 *   null when no player has this id
 */
async function getPlayerTransfers(playerId) {
  if (!(await Player.exists({ _id: playerId }))) return null;

  const transfers = await Transfer.find({ player: playerId })
    .sort({ date: 1 })
    .populate("seller", "name")
    .populate("buyer", "name")
    .lean();

  return transfers.map((t) => ({
    date: t.date,
    fromClub: toClub(t.seller),
    toClub: toClub(t.buyer),
    fee: t.price ?? null,
  }));
}

module.exports = { getPlayerTransfers };
