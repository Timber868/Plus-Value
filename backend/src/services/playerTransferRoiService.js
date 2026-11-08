const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const { findExit, loanStatus, valueOnOrBefore } = require("./transferRoi");

/**
 * Shapes a populated club reference for the API, or null when absent.
 *
 * @param {{ _id: *, name: string } | null | undefined} club
 */
function toClub(club) {
  return club ? { id: String(club._id), name: club.name } : null;
}

const sameClub = (a, b) => a != null && b != null && String(a) === String(b);
/** A signing date earlier than any transfer, for players the club formed */
const BEFORE_ANY_TRANSFER = new Date(-8.64e15);

/**
 * Lists a player's transfers (oldest first) with the result of each one for
 * the selling club: what it received against what it paid for the player.
 *
 * - sellerCost: the fee the selling club paid when it got the player, that
 *   is its latest earlier signing of him (loan returns aside). With no such
 *   signing the club formed him (homegrown) and the cost is 0. Null when the
 *   fee is unknown or the move has no selling club.
 * - loanFees: loan fees the selling club earned while he was its player.
 * - gain: fee + loanFees - sellerCost, null when an amount is unknown.
 * - roiPercent: gain over sellerCost in percent, one decimal; null when the
 *   cost is 0 or the gain unknown.
 *
 * Returns from a loan are left out. A loan out is kept and flagged with
 * isLoan; its fee is shown but it has no gain, since the loan fee already
 * counts in the gain of the club's later sale.
 *
 * @param {string} playerId Mongo id of the Player
 * @returns {Promise<object[] | null>} null when no player has this id
 */
async function getPlayerTransferRoi(playerId) {
  if (!(await Player.exists({ _id: playerId }))) return null;

  const [transfers, valuations] = await Promise.all([
    Transfer.find({ player: playerId }).sort({ date: 1 }).populate("seller", "name").populate("buyer", "name").lean(),
    MarketValue.find({ player: playerId }, { date: 1, value: 1 }).lean(),
  ]);

  // Seller and buyer are populated; loan checks compare their ids
  const idOf = (club) => (club ? club._id : null);
  const moves = transfers.map((t) => ({ date: t.date, fee: t.price ?? null, buyer: idOf(t.buyer), seller: idOf(t.seller) }));
  const status = moves.map((m) => loanStatus(m, moves));

  const rows = [];
  moves.forEach((move, i) => {
    if (status[i].isLoanReturn) return;

    let sellerCost = null;
    let homegrown = false;
    let loanFees = 0;
    if (move.seller && !status[i].isLoan) {
      let j = i - 1;
      while (j >= 0 && !(sameClub(moves[j].buyer, move.seller) && !status[j].isLoanReturn)) j--;
      homegrown = j < 0;
      const signing = homegrown ? { date: BEFORE_ANY_TRANSFER, fee: 0, buyer: move.seller } : moves[j];
      sellerCost = signing.fee;
      const exit = findExit(signing, moves);
      // The sale ends the stay that began with the signing, so its loan fees are the club's
      if (exit.exitTransfer === move) loanFees = exit.loanFees;
    }

    const gain = sellerCost !== null && move.fee !== null ? move.fee + loanFees - sellerCost : null;
    const atSale = valueOnOrBefore(valuations, move.date);
    rows.push({
      date: move.date,
      fromClub: toClub(transfers[i].seller),
      toClub: toClub(transfers[i].buyer),
      isLoan: status[i].isLoan,
      fee: move.fee,
      sellerCost,
      homegrown,
      loanFees,
      marketValueAtSale: atSale ? { value: atSale.value, date: atSale.date } : null,
      gain,
      roiPercent: gain !== null && sellerCost > 0 ? Math.round((gain / sellerCost) * 1000) / 10 : null,
    });
  });
  return rows;
}

module.exports = { getPlayerTransferRoi };
