const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const { getCurrentValueCutoff } = require("./marketValueCutoff");
const { findExitTransfer, computeTransferRoi } = require("./transferRoi");

/**
 * Shapes a populated club reference for the API, or null when absent.
 *
 * @param {{ _id: *, name: string } | null | undefined} club
 */
function toClub(club) {
  return club ? { id: String(club._id), name: club.name } : null;
}

/**
 * Lists a player's transfers (oldest first) with the ROI figures of each one
 * from the buying club's point of view (see transferRoi.js). The exit of a
 * transfer is the player's next transfer, or his current valuation for the
 * latest one.
 *
 * @param {string} playerId Mongo id of the Player
 * @returns {Promise<object[] | null>} null when no player has this id
 */
async function getPlayerTransferRoi(playerId) {
  if (!(await Player.exists({ _id: playerId }))) return null;

  const [transfers, valuations, currentCutoff] = await Promise.all([
    Transfer.find({ player: playerId }).sort({ date: 1 }).populate("seller", "name").populate("buyer", "name").lean(),
    MarketValue.find({ player: playerId }, { date: 1, value: 1 }).lean(),
    getCurrentValueCutoff(),
  ]);

  const withFees = transfers.map((t) => ({ date: t.date, fee: t.price ?? null }));

  return transfers.map((t, i) => ({
    date: t.date,
    fromClub: toClub(t.seller),
    toClub: toClub(t.buyer),
    ...computeTransferRoi({
      transfer: withFees[i],
      valuations,
      exitTransfer: findExitTransfer(withFees[i], withFees),
      currentCutoff,
    }),
  }));
}

module.exports = { getPlayerTransferRoi };
