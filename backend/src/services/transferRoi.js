const { currentOrNull } = require("./marketValueCutoff");

/**
 * Transfer ROI rules (KF-2). Pure functions, no database access.
 *
 * - Fee paid: the transfer fee, or null when the dataset has none (free or
 *   undisclosed). A recorded 0 stays 0.
 * - Market value at signing: the player's valuation closest to the transfer
 *   date on or before it, or null when the player had no valuation yet.
 * - Loans out do not end the player's stay. The dataset has no loan flag, so
 *   a move from the buying club to club X counts as a loan when the player's
 *   very next move is X back to the buying club, with no fee (0 or none), at
 *   most MAX_LOAN_DAYS later. A fee on the way back means the club bought him
 *   back, so the first move was a real sale. The loan fee (the fee on the way
 *   out; none counts as 0) is income for the buying club. A paid move out
 *   that the player follows back to the buyer for free after a short return
 *   is a sale with a loan back, not a loan (see isSaleWithLoanBack).
 * - Exit: the first move away from the buying club that is not a loan
 *   ("resale"), valued at its fee plus the loan fees earned before it; null
 *   when the resale fee is unknown. When the player never left for good, his
 *   latest valuation ("marketValue") plus the loan fees, but only when that
 *   valuation still counts as current (see marketValueCutoff); a stale value
 *   gives null.
 * - Gain: exit value minus fee paid, null when either is unknown.
 * - ROI: gain as a percentage of the fee paid, rounded to one decimal. Null
 *   when the gain is unknown or the fee paid is 0 (no meaningful percentage).
 *
 * Example: bought for 10M, loaned out for 3M, then sold for 10M. The loan is
 * not the exit, the exit value is 13M and the gain is 3M (ROI 30%).
 */

/** Longest gap between a loan move and the return that still counts as a loan. */
const MAX_LOAN_DAYS = 731;
const DAY_MS = 24 * 60 * 60 * 1000;

const time = (date) => new Date(date).getTime();
const sameClub = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Valuation closest to the date, on or before it.
 *
 * @param {Array<{ date: Date, value: number }>} valuations any order
 * @param {Date} date
 * @returns {{ date: Date, value: number } | null}
 */
function valueOnOrBefore(valuations, date) {
  const limit = time(date);
  let best = null;
  for (const v of valuations) {
    const t = time(v.date);
    if (t <= limit && (!best || t > time(best.date))) best = v;
  }
  return best;
}

/**
 * Latest valuation, or null when there are none.
 *
 * @param {Array<{ date: Date, value: number }>} valuations any order
 */
function latestValue(valuations) {
  return valueOnOrBefore(valuations, new Date(8.64e15));
}

/**
 * Whether a move out of a club is a loan, given the player's next move.
 *
 * @param {{ date: Date, buyer: *, seller: * }} move
 * @param {{ date: Date, fee: number | null, buyer: *, seller: * } | undefined} next
 */
function isLoan(move, next) {
  return (
    next !== undefined &&
    sameClub(next.seller, move.buyer) &&
    sameClub(next.buyer, move.seller) &&
    !(next.fee > 0) &&
    time(next.date) - time(move.date) <= MAX_LOAN_DAYS * DAY_MS
  );
}

/**
 * Whether a paid move that looks like a loan (see isLoan) is really a sale
 * with a loan back: the buyer pays, lends the player back to the seller for
 * the rest of the season, and the player then rejoins the buyer for free.
 * For example Malo Gusto: Lyon to Chelsea for 30M, back to Lyon on loan,
 * then to Chelsea at the end of the loan.
 *
 * @param {{ buyer: *, seller: *, fee: number | null }} move the paid move out
 * @param {{ buyer: *, seller: *, fee: number | null } | undefined} afterReturn
 *   the move that follows the return to the seller
 */
function isSaleWithLoanBack(move, afterReturn) {
  return (
    move.fee > 0 &&
    afterReturn !== undefined &&
    sameClub(afterReturn.seller, move.seller) &&
    sameClub(afterReturn.buyer, move.buyer) &&
    !(afterReturn.fee > 0)
  );
}

/**
 * Whether a transfer is the start of a loan (the player comes straight back,
 * see isLoan) or the end of one (the move back). A loan return is not a
 * signing, so ROI lists leave it out; otherwise the later sale would count
 * twice, once for the real signing and once for the return.
 *
 * @param {{ date: Date, buyer: *, seller: * }} transfer
 * @param {Array<{ date: Date, fee: number | null, buyer: *, seller: * }>} playerTransfers
 *   all of the player's transfers, any order (including this one)
 * @returns {{ isLoan: boolean, isLoanReturn: boolean }}
 */
function loanStatus(transfer, playerTransfers) {
  const at = time(transfer.date);
  const sorted = [...playerTransfers].sort((a, b) => time(a.date) - time(b.date));
  const previous = sorted.filter((t) => time(t.date) < at).pop();
  const [next, afterNext] = sorted.filter((t) => time(t.date) > at);
  const isLoanReturn = previous !== undefined && isLoan(previous, transfer) && !isSaleWithLoanBack(previous, next);
  const startsLoan = isLoan(transfer, next) && !isSaleWithLoanBack(transfer, afterNext);
  return { isLoan: !isLoanReturn && startsLoan, isLoanReturn };
}

/**
 * Finds how the player's stay at the buying club ended: the first later move
 * that is not a loan out (see the rules above), and the loan fees the club
 * earned before it.
 *
 * @param {{ date: Date, buyer: * }} transfer the signing
 * @param {Array<{ date: Date, fee: number | null, buyer: *, seller: * }>} playerTransfers
 *   all of the player's transfers, any order
 * @returns {{ exitTransfer: object | null, loanFees: number }} exitTransfer is
 *   null when the player never left for good
 */
function findExit(transfer, playerTransfers) {
  const start = time(transfer.date);
  const later = playerTransfers.filter((t) => time(t.date) > start).sort((a, b) => time(a.date) - time(b.date));

  let loanFees = 0;
  let i = 0;
  while (i < later.length) {
    const move = later[i];
    if (
      sameClub(move.seller, transfer.buyer) &&
      isLoan(move, later[i + 1]) &&
      !isSaleWithLoanBack(move, later[i + 2])
    ) {
      loanFees += move.fee ?? 0;
      i += 2;
    } else {
      return { exitTransfer: move, loanFees };
    }
  }
  return { exitTransfer: null, loanFees };
}

/**
 * Computes the ROI figures of one transfer.
 *
 * @param {object} args
 * @param {{ date: Date, fee: number | null }} args.transfer
 * @param {Array<{ date: Date, value: number }>} args.valuations the player's valuations
 * @param {{ date: Date, fee: number | null } | null} args.exitTransfer see findExit
 * @param {number} [args.loanFees] loan fees earned before the exit, see findExit
 * @param {Date | null} args.currentCutoff see getCurrentValueCutoff
 */
function computeTransferRoi({ transfer, valuations, exitTransfer, loanFees = 0, currentCutoff }) {
  const feePaid = transfer.fee ?? null;
  const signing = valueOnOrBefore(valuations, transfer.date);
  const plusLoans = (value) => (value === null ? null : value + loanFees);

  let exit;
  if (exitTransfer) {
    exit = { type: "resale", value: plusLoans(exitTransfer.fee ?? null), date: exitTransfer.date, loanFees };
  } else {
    const current = currentOrNull(latestValue(valuations), currentCutoff);
    exit = {
      type: "marketValue",
      value: current ? plusLoans(current.value) : null,
      date: current ? current.date : null,
      loanFees,
    };
  }

  const gain = feePaid !== null && exit.value !== null ? exit.value - feePaid : null;
  const roiPercent = gain !== null && feePaid > 0 ? Math.round((gain / feePaid) * 1000) / 10 : null;

  return {
    feePaid,
    marketValueAtSigning: signing ? { value: signing.value, date: signing.date } : null,
    exit,
    gain,
    roiPercent,
  };
}

/** A signing date earlier than any transfer, for players the club formed */
const BEFORE_ANY_TRANSFER = new Date(-8.64e15);

/**
 * Result of a sale for the selling club: what it received against what the
 * player cost it.
 *
 * - sellerCost: the fee of the club's latest signing of the player before the
 *   sale (loan returns aside). With no such signing the club formed him
 *   (homegrown) and the cost is 0. Null when that fee is unknown.
 * - loanFees: loan fees the club earned while he was its player.
 * - gain: sale fee + loanFees - sellerCost, null when an amount is unknown.
 * - roiPercent: gain over sellerCost in percent, one decimal; null when the
 *   cost is 0 or the gain unknown.
 *
 * @param {{ date: Date, fee: number | null, seller: *, buyer: * }} sale one of playerTransfers
 * @param {Array<{ date: Date, fee: number | null, buyer: *, seller: * }>} playerTransfers
 *   all of the player's transfers, any order (including the sale)
 */
function computeSaleResult(sale, playerTransfers) {
  const earlier = playerTransfers
    .filter((t) => time(t.date) < time(sale.date) && sameClub(t.buyer, sale.seller))
    .filter((t) => !loanStatus(t, playerTransfers).isLoanReturn)
    .sort((a, b) => time(a.date) - time(b.date));
  const signing = earlier.pop();
  const homegrown = signing === undefined;
  const sellerCost = homegrown ? 0 : signing.fee ?? null;

  // The sale ends the stay that began with the signing, so the loan fees before it are the club's
  const exit = findExit(homegrown ? { date: BEFORE_ANY_TRANSFER, buyer: sale.seller } : signing, playerTransfers);
  const loanFees = exit.exitTransfer === sale ? exit.loanFees : 0;

  const fee = sale.fee ?? null;
  const gain = sellerCost !== null && fee !== null ? fee + loanFees - sellerCost : null;
  const roiPercent = gain !== null && sellerCost > 0 ? Math.round((gain / sellerCost) * 1000) / 10 : null;
  return { sellerCost, homegrown, loanFees, gain, roiPercent };
}

module.exports = {
  MAX_LOAN_DAYS,
  valueOnOrBefore,
  latestValue,
  isLoan,
  loanStatus,
  findExit,
  computeTransferRoi,
  computeSaleResult,
};
