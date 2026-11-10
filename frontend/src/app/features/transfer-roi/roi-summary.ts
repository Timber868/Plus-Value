import { ClubTransferRoi } from './models/transfer-roi.model';

/**
 * Headline figures of the club ROI page (Tim, Nov 9). Players bought and
 * players the club formed are kept apart:
 *
 * - Recruits: every incoming move except those from the club's own reserve or
 *   youth team. For each one, what he brought back is his exit value: the
 *   sale fee if he was sold, his current market value if he is still at the
 *   club (loan fees earned included). Only recruits whose fee and exit value
 *   are both known count, so the net gain is exactly what came back minus
 *   what was spent.
 * - Academy: players who came up from the club's own reserve or youth team in
 *   the period, with what they were sold for and what those still at the
 *   club are worth.
 */
export interface RoiSummary {
  recruits: {
    /** Fees paid for the counted recruits */
    spent: number;
    /** Sale fees of the counted recruits who were sold */
    sold: number;
    /** Current value of the counted recruits still at the club */
    stillHere: number;
    /** sold + stillHere */
    returned: number;
    /** returned - spent */
    net: number;
    /** Recruits counted */
    counted: number;
    /** Recruits left out because their fee or exit value is unknown */
    unknown: number;
  };
  academy: {
    /** Sale fees of the academy players who were sold */
    sold: number;
    /** Current value of those still at the club */
    stillHere: number;
    /** sold + stillHere */
    total: number;
    /** Academy players who came up in the period */
    count: number;
  };
}

export function summarizeRoi(rows: ClubTransferRoi[]): RoiSummary {
  const recruits = { spent: 0, sold: 0, stillHere: 0, returned: 0, net: 0, counted: 0, unknown: 0 };
  const academy = { sold: 0, stillHere: 0, total: 0, count: 0 };

  for (const row of rows) {
    const value = row.exit.value;
    const sold = row.exit.type === 'resale';
    if (row.reserveTeamMove) {
      academy.count++;
      if (value !== null) {
        if (sold) academy.sold += value;
        else academy.stillHere += value;
      }
      continue;
    }
    if (row.feePaid === null || value === null) {
      recruits.unknown++;
      continue;
    }
    recruits.counted++;
    recruits.spent += row.feePaid;
    if (sold) recruits.sold += value;
    else recruits.stillHere += value;
  }

  recruits.returned = recruits.sold + recruits.stillHere;
  recruits.net = recruits.returned - recruits.spent;
  academy.total = academy.sold + academy.stillHere;
  return { recruits, academy };
}
