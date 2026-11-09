const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const { loanStatus, valueOnOrBefore, computeSaleResult } = require("./transferRoi");
const { resolveFee } = require("./reserveTeam");
const { defaultInflation, adjustAmount, adjustGain } = require("./inflation");

/**
 * Shapes a populated club reference for the API, or null when absent.
 *
 * @param {{ _id: *, name: string } | null | undefined} club
 */
function toClub(club) {
  return club ? { id: String(club._id), name: club.name } : null;
}

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
 * An unknown fee between a club and its own reserve or youth team counts as
 * 0 (reserveTeamMove, see reserveTeam.js).
 *
 * Returns from a loan are left out. A loan out is kept and flagged with
 * isLoan; its fee is shown but it has no gain, since the loan fee already
 * counts in the gain of the club's later sale.
 *
 * Each row also has `adjusted`: the fee, cost, gain and ROI in constant euros
 * of the reference year (see inflation.js), the cost taken at the seller's
 * signing date and the fee and loan fees at the sale date.
 *
 * @param {string} playerId Mongo id of the Player
 * @param {{ inflation?: object }} [options] index and reference year, HICP by default
 * @returns {Promise<object[] | null>} null when no player has this id
 */
async function getPlayerTransferRoi(playerId, { inflation = defaultInflation() } = {}) {
  if (!(await Player.exists({ _id: playerId }))) return null;

  const [transfers, valuations] = await Promise.all([
    Transfer.find({ player: playerId }).sort({ date: 1 }).populate("seller", "name").populate("buyer", "name").lean(),
    MarketValue.find({ player: playerId }, { date: 1, value: 1 }).lean(),
  ]);

  // Seller and buyer are populated; loan checks compare their ids
  const idOf = (club) => (club ? club._id : null);
  const resolved = transfers.map((t) => resolveFee(t.price, t.seller && t.seller.name, t.buyer && t.buyer.name));
  const moves = transfers.map((t, i) => ({
    date: t.date,
    fee: resolved[i].fee,
    reserveTeamMove: resolved[i].reserveTeamMove,
    buyer: idOf(t.buyer),
    seller: idOf(t.seller),
  }));
  const status = moves.map((m) => loanStatus(m, moves));

  const rows = [];
  moves.forEach((move, i) => {
    if (status[i].isLoanReturn) return;

    const result =
      move.seller && !status[i].isLoan
        ? computeSaleResult(move, moves)
        : { sellerCost: null, homegrown: false, loanFees: 0, gain: null, roiPercent: null, signingDate: null };
    const adjusted =
      result.gain === null
        ? { cost: adjustAmount(result.sellerCost, result.signingDate, inflation), gain: null, roiPercent: null }
        : adjustGain(
            { cost: result.sellerCost, costDate: result.signingDate, value: move.fee + result.loanFees, valueDate: move.date },
            inflation,
          );
    const atSale = valueOnOrBefore(valuations, move.date);
    rows.push({
      date: move.date,
      fromClub: toClub(transfers[i].seller),
      toClub: toClub(transfers[i].buyer),
      isLoan: status[i].isLoan,
      reserveTeamMove: resolved[i].reserveTeamMove,
      fee: move.fee,
      sellerCost: result.sellerCost,
      homegrown: result.homegrown,
      loanFees: result.loanFees,
      marketValueAtSale: atSale ? { value: atSale.value, date: atSale.date } : null,
      gain: result.gain,
      roiPercent: result.roiPercent,
      adjusted: {
        fee: adjustAmount(move.fee, move.date, inflation),
        sellerCost: adjusted.cost,
        gain: adjusted.gain,
        roiPercent: adjusted.roiPercent,
      },
    });
  });
  return rows;
}

module.exports = { getPlayerTransferRoi };
