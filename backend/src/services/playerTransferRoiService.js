const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const { getCurrentValueCutoff } = require("./marketValueCutoff");
const { findExit, loanStatus, computeTransferRoi } = require("./transferRoi");

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
 * transfer is the first later move that is not a loan out, with the loan fees
 * earned before it, or his current valuation when he never left for good.
 * Returns from a loan are left out (they are not signings, and would count
 * the later sale twice); the start of a loan is kept and flagged with isLoan.
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

  // Seller and buyer are populated; loan checks compare their ids
  const idOf = (club) => (club ? club._id : null);
  const moves = transfers.map((t) => ({ date: t.date, fee: t.price ?? null, buyer: idOf(t.buyer), seller: idOf(t.seller) }));

  const rows = [];
  transfers.forEach((t, i) => {
    const { isLoan, isLoanReturn } = loanStatus(moves[i], moves);
    if (isLoanReturn) return;
    rows.push({
      date: t.date,
      fromClub: toClub(t.seller),
      toClub: toClub(t.buyer),
      isLoan,
      ...computeTransferRoi({ transfer: moves[i], valuations, ...findExit(moves[i], moves), currentCutoff }),
    });
  });
  return rows;
}

module.exports = { getPlayerTransferRoi };
