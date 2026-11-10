import { ClubTransferRoi } from './models/transfer-roi.model';
import { summarizeRoi } from './roi-summary';

/** A purchase row with only the fields the summary reads */
function row(fields: {
  feePaid: number | null;
  exit: ClubTransferRoi['exit']['type'];
  value: number | null;
  reserveTeamMove?: boolean;
}): ClubTransferRoi {
  return {
    feePaid: fields.feePaid,
    reserveTeamMove: fields.reserveTeamMove ?? false,
    exit: { type: fields.exit, value: fields.value, date: null, loanFees: 0 }
  } as ClubTransferRoi;
}

describe('summarizeRoi', () => {
  const summary = summarizeRoi([
    // Bought 10M, sold 25M
    row({ feePaid: 10_000_000, exit: 'resale', value: 25_000_000 }),
    // Bought 20M, worth 12M now
    row({ feePaid: 20_000_000, exit: 'marketValue', value: 12_000_000 }),
    // Unknown fee: left out of the recruits' figures
    row({ feePaid: null, exit: 'marketValue', value: 5_000_000 }),
    // Left without a known value: left out too
    row({ feePaid: 3_000_000, exit: 'left', value: null }),
    // Academy: one sold for 30M, one worth 8M
    row({ feePaid: 0, exit: 'resale', value: 30_000_000, reserveTeamMove: true }),
    row({ feePaid: 0, exit: 'marketValue', value: 8_000_000, reserveTeamMove: true })
  ]);

  it('adds what the recruits were sold for and what those still here are worth, against what they cost', () => {
    expect(summary.recruits).toEqual({
      spent: 30_000_000,
      sold: 25_000_000,
      stillHere: 12_000_000,
      returned: 37_000_000,
      net: 7_000_000,
      counted: 2,
      unknown: 2
    });
  });

  it('keeps the academy players apart, with their sales and current value', () => {
    expect(summary.academy).toEqual({ sold: 30_000_000, stillHere: 8_000_000, total: 38_000_000, count: 2 });
  });

  it('gives zeros for an empty list', () => {
    expect(summarizeRoi([]).recruits.net).toBe(0);
    expect(summarizeRoi([]).academy.count).toBe(0);
  });
});
