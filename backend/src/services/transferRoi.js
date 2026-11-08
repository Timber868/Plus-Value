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
 *   out; none counts as 0) is income for the buying club.
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
    if (sameClub(move.seller, transfer.buyer) && isLoan(move, later[i + 1])) {
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

module.exports = { MAX_LOAN_DAYS, valueOnOrBefore, latestValue, isLoan, findExit, computeTransferRoi };
