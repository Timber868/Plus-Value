import { byCurrentMarketValue } from './transfer-roi-sort';

describe('byCurrentMarketValue', () => {
  it('puts the highest current value first and unknown values last', () => {
    const rows = [
      { name: 'a', currentMarketValue: 5 },
      { name: 'b', currentMarketValue: null },
      { name: 'c', currentMarketValue: 20 },
      { name: 'd', currentMarketValue: null },
      { name: 'e', currentMarketValue: 0 }
    ];

    expect(byCurrentMarketValue(rows).map((r) => r.name)).toEqual(['c', 'a', 'e', 'b', 'd']);
  });

  it('does not change the input', () => {
    const rows = [
      { currentMarketValue: 1 },
      { currentMarketValue: 2 }
    ];
    byCurrentMarketValue(rows);
    expect(rows[0].currentMarketValue).toBe(1);
  });
});
