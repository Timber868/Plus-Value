const Club = require("../models/Club");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const Season = require("../models/Season");
const { getCurrentValueCutoff, currentOrNull } = require("./marketValueCutoff");
const { findExit, loanStatus, computeTransferRoi, latestValue, computeSaleResult } = require("./transferRoi");
const { resolveFee } = require("./reserveTeam");

/**
 * Shapes a populated club reference for the API, or null when absent.
 *
 * @param {{ _id: *, name: string } | null | undefined} club
 */
function toClub(club) {
  return club ? { id: String(club._id), name: club.name } : null;
}

/**
 * Sums the numbers of a list, skipping nulls.
 *
 * @param {Array<number | null>} values
 */
function sumKnown(values) {
  return values.reduce((sum, v) => (v === null ? sum : sum + v), 0);
}

/**
 * Club totals over the per-transfer ROI rows. Unknown amounts are left out
 * of every sum, so netGain only covers transfers whose gain is known. Each
 * exit value includes the loan fees earned before it (see transferRoi.js);
 * the totals report them apart in totalLoanIncome, so the current value and
 * resale income sums hold only valuations and resale fees.
 *
 * @param {Array<{ feePaid: number | null, exit: { type: string, value: number | null, loanFees?: number }, gain: number | null }>} rows
 */
function computeTotals(rows) {
  const loanFees = (r) => r.exit.loanFees ?? 0;
  const withoutLoans = (type) =>
    rows.filter((r) => r.exit.type === type && r.exit.value !== null).map((r) => r.exit.value - loanFees(r));
  return {
    totalSpent: sumKnown(rows.map((r) => r.feePaid)),
    totalCurrentValue: sumKnown(withoutLoans("marketValue")),
    totalResaleIncome: sumKnown(withoutLoans("resale")),
    totalLoanIncome: sumKnown(rows.map(loanFees)),
    netGain: sumKnown(rows.map((r) => r.gain)),
  };
}

/**
 * Ids of every season (any league) with the same period as this one, so a
 * season picked in one league also finds transfers filed under another
 * league's season of the same year. Empty for an unknown season.
 *
 * @param {string} seasonId
 */
async function samePeriodSeasonIds(seasonId) {
  const season = await Season.findById(seasonId, { period: 1 }).lean();
  return season ? Season.distinct("_id", { period: season.period }) : [];
}

/**
 * The player's latest valuation when it still counts as current (see
 * marketValueCutoff), otherwise null.
 *
 * @param {Array<{ date: Date, value: number }>} valuations
 * @param {Date | null} currentCutoff
 */
function currentValue(valuations, currentCutoff) {
  const current = currentOrNull(latestValue(valuations), currentCutoff);
  return current ? current.value : null;
}

/**
 * Lists a club's incoming transfers (oldest first) with the ROI figures of
 * each one (see transferRoi.js), plus club totals, and the club's sales.
 *
 * Purchases: a player coming back from a loan the club gave him is not a
 * signing, so those returns are left out; a player the club took on loan is
 * kept and flagged with isLoan. soldFor is the fee of the move that ended
 * his stay for good, without loan fees; null when he is still at the club,
 * was only on loan, or the fee is unknown. Both gains are measured against
 * the fee paid: valueGain is the current market value minus it (null for a
 * player taken on loan), resaleGain is soldFor minus it. An unknown fee
 * between the club and its own reserve or youth team counts as 0
 * (reserveTeamMove, see reserveTeam.js).
 *
 * Sales: the club's permanent departures (oldest first). Loans out and the
 * return of a player the club had on loan are not sales. soldFor is null
 * when the fee is unknown. gain is what the club made on the sale: soldFor
 * plus the loan fees it earned minus what the player cost it (sellerCost,
 * 0 when it formed him), see computeSaleResult.
 *
 * Every row carries the player's currentMarketValue (null when he was not
 * revalued in the last market window).
 *
 * @param {string} clubId Mongo id of the Club
 * @param {{ seasonId?: string | null }} [options] only transfers of this season's period
 *   (e.g. 2025-2026), whatever league the transfer's season belongs to
 * @returns {Promise<{ transfers: object[], totals: object, sales: object[] } | null>} null when no club has this id
 */
async function getClubTransferRoi(clubId, { seasonId = null } = {}) {
  const club = await Club.findById(clubId, { name: 1 }).lean();
  if (!club) return null;

  const seasonFilter = seasonId ? { season: { $in: await samePeriodSeasonIds(seasonId) } } : {};
  const populatePlayer = { path: "player", select: "person", populate: { path: "person", select: "name" } };

  const [incoming, outgoing] = await Promise.all([
    Transfer.find({ buyer: clubId, ...seasonFilter }).sort({ date: 1 }).populate(populatePlayer).populate("seller", "name").lean(),
    Transfer.find({ seller: clubId, ...seasonFilter }).sort({ date: 1 }).populate(populatePlayer).populate("buyer", "name").lean(),
  ]);

  const playerIds = [...new Set([...incoming, ...outgoing].map((t) => String(t.player._id)))];
  const [playerTransfers, valuations, currentCutoff] = await Promise.all([
    Transfer.find({ player: { $in: playerIds } }, { player: 1, date: 1, price: 1, buyer: 1, seller: 1 })
      .populate("seller", "name")
      .populate("buyer", "name")
      .lean(),
    MarketValue.find({ player: { $in: playerIds } }, { player: 1, date: 1, value: 1 }).lean(),
    getCurrentValueCutoff(),
  ]);

  // Loan checks compare club ids; names only serve to spot reserve team moves
  const idOf = (c) => (c && c._id !== undefined ? c._id : c ?? null);
  const nameOf = (c) => (c && c.name) || null;
  const history = playerTransfers.map((t) => ({
    player: t.player,
    date: t.date,
    fee: resolveFee(t.price, nameOf(t.seller), nameOf(t.buyer)).fee,
    buyer: idOf(t.buyer),
    seller: idOf(t.seller),
  }));
  const transfersByPlayer = groupByPlayer(history);
  const valuationsByPlayer = groupByPlayer(valuations);
  const toPlayer = (t) => ({ id: String(t.player._id), name: t.player.person ? t.player.person.name : null });

  const transfers = [];
  for (const t of incoming) {
    const playerId = String(t.player._id);
    const history = transfersByPlayer.get(playerId) || [];
    const playerValuations = valuationsByPlayer.get(playerId) || [];
    // The incoming list has the seller populated; loan checks compare ids
    const { fee, reserveTeamMove } = resolveFee(t.price, nameOf(t.seller), club.name);
    const signing = { date: t.date, fee, buyer: t.buyer, seller: idOf(t.seller) };
    const { isLoan, isLoanReturn } = loanStatus(signing, history);
    if (isLoanReturn) continue;

    const exit = findExit(signing, history);
    const roi = computeTransferRoi({ transfer: signing, valuations: playerValuations, ...exit, currentCutoff });
    const soldFor = exit.exitTransfer && !isLoan ? exit.exitTransfer.fee ?? null : null;
    const currentMarketValue = currentValue(playerValuations, currentCutoff);
    const minusFee = (value) => (value !== null && fee !== null ? value - fee : null);
    transfers.push({
      player: toPlayer(t),
      date: t.date,
      fromClub: toClub(t.seller),
      isLoan,
      reserveTeamMove,
      ...roi,
      soldFor,
      currentMarketValue,
      valueGain: isLoan ? null : minusFee(currentMarketValue),
      resaleGain: minusFee(soldFor),
    });
  }

  const sales = [];
  for (const t of outgoing) {
    const playerId = String(t.player._id);
    const playerHistory = transfersByPlayer.get(playerId) || [];
    const move = { date: t.date, fee: resolveFee(t.price, club.name, nameOf(t.buyer)).fee, buyer: idOf(t.buyer), seller: t.seller };
    // Use the history's copy of the move, so the sale can be matched against the player's stays
    const sale =
      playerHistory.find(
        (h) => new Date(h.date).getTime() === new Date(move.date).getTime() && String(h.seller) === String(move.seller),
      ) || move;
    const { isLoan, isLoanReturn } = loanStatus(sale, playerHistory);
    if (isLoan || isLoanReturn) continue;

    const { sellerCost, homegrown, gain } = computeSaleResult(sale, playerHistory);
    sales.push({
      player: toPlayer(t),
      date: t.date,
      toClub: toClub(t.buyer),
      soldFor: move.fee,
      sellerCost,
      homegrown,
      gain,
      currentMarketValue: currentValue(valuationsByPlayer.get(playerId) || [], currentCutoff),
    });
  }

  return { transfers, totals: computeTotals(transfers), sales };
}

/**
 * Groups documents by their player id.
 *
 * @param {Array<{ player: * }>} docs
 * @returns {Map<string, object[]>}
 */
function groupByPlayer(docs) {
  const groups = new Map();
  for (const doc of docs) {
    const key = String(doc.player);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  return groups;
}

module.exports = { computeTotals, getClubTransferRoi };
