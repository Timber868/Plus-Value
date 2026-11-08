import { ClubTransferRoi } from './models/transfer-roi.model';
import { sortTransfers } from './transfer-roi-sort';

function row(name: string | null, date: string, gain: number | null): ClubTransferRoi {
  return {
    player: { id: name ?? 'x', name },
    date,
    fromClub: null,
    isLoan: false,
    feePaid: null,
    marketValueAtSigning: null,
    exit: { type: 'marketValue', value: null, date: null, loanFees: 0 },
    gain,
    roiPercent: null
  };
}

describe('sortTransfers', () => {
  const rows = [
    row('Émile', '2022-07-01', 5),
    row('anthony', '2024-01-10', null),
    row('Bruno', '2023-07-01', -2),
    row(null, '2021-07-01', 9)
  ];
  const names = (sorted: ClubTransferRoi[]) => sorted.map((r) => r.player.name);

  it('sorts by date in both directions', () => {
    expect(names(sortTransfers(rows, 'date', 'desc'))).toEqual(['anthony', 'Bruno', 'Émile', null]);
    expect(names(sortTransfers(rows, 'date', 'asc'))).toEqual([null, 'Émile', 'Bruno', 'anthony']);
  });

  it('keeps unknown values last in both directions', () => {
    expect(names(sortTransfers(rows, 'gain', 'desc'))).toEqual([null, 'Émile', 'Bruno', 'anthony']);
    expect(names(sortTransfers(rows, 'gain', 'asc'))).toEqual(['Bruno', 'Émile', null, 'anthony']);
  });

  it('sorts names in French order, ignoring case and accents', () => {
    expect(names(sortTransfers(rows, 'player', 'asc'))).toEqual(['anthony', 'Bruno', 'Émile', null]);
  });

  it('does not change the input', () => {
    sortTransfers(rows, 'gain', 'asc');
    expect(names(rows)).toEqual(['Émile', 'anthony', 'Bruno', null]);
  });
});
