const { currentOrNull } = require("./marketValueCutoff");

/**
 * Transfer ROI rules (KF-2). Pure functions, no database access.
 *
 * - Fee paid: the transfer fee, or null when the dataset has none (free or
 *   undisclosed). A recorded 0 stays 0.
 * - Market value at signing: the player's valuation closest to the transfer
 *   date on or before it, or null when the player had no valuation yet.
 * - Exit value: when the player later left the club (his next transfer), the
 *   fee of that move ("resale"); null when that fee is unknown. Otherwise the
 *   player's latest valuation ("marketValue"), but only when it still counts
 *   as current (see marketValueCutoff); a stale value gives null.
 * - Gain: exit value minus fee paid, null when either is unknown.
 * - ROI: gain as a percentage of the fee paid, rounded to one decimal. Null
 *   when the gain is unknown or the fee paid is 0 (no meaningful percentage).
 */

/**
 * Valuation closest to the date, on or before it.
 *
 * @param {Array<{ date: Date, value: number }>} valuations any order
 * @param {Date} date
 * @returns {{ date: Date, value: number } | null}
 */
function valueOnOrBefore(valuations, date) {
  const limit = new Date(date).getTime();
  let best = null;
  for (const v of valuations) {
    const t = new Date(v.date).getTime();
    if (t <= limit && (!best || t > new Date(best.date).getTime())) best = v;
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
 * The player's first transfer after the given one: the move that ended his
 * stay at the buying club.
 *
 * @param {{ date: Date }} transfer
 * @param {Array<{ date: Date }>} playerTransfers all of the player's transfers, any order
 * @returns {object | null}
 */
function findExitTransfer(transfer, playerTransfers) {
  const start = new Date(transfer.date).getTime();
  let next = null;
  for (const t of playerTransfers) {
    const time = new Date(t.date).getTime();
    if (time > start && (!next || time < new Date(next.date).getTime())) next = t;
  }
  return next;
}

/**
 * Computes the ROI figures of one transfer.
 *
 * @param {object} args
 * @param {{ date: Date, fee: number | null }} args.transfer
 * @param {Array<{ date: Date, value: number }>} args.valuations the player's valuations
 * @param {{ date: Date, fee: number | null } | null} args.exitTransfer see findExitTransfer
 * @param {Date | null} args.currentCutoff see getCurrentValueCutoff
 */
function computeTransferRoi({ transfer, valuations, exitTransfer, currentCutoff }) {
  const feePaid = transfer.fee ?? null;
  const signing = valueOnOrBefore(valuations, transfer.date);

  let exit;
  if (exitTransfer) {
    exit = { type: "resale", value: exitTransfer.fee ?? null, date: exitTransfer.date };
  } else {
    const current = currentOrNull(latestValue(valuations), currentCutoff);
    exit = { type: "marketValue", value: current ? current.value : null, date: current ? current.date : null };
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

module.exports = { valueOnOrBefore, latestValue, findExitTransfer, computeTransferRoi };
