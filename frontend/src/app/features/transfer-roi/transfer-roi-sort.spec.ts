import { nextSort, sortRows } from './transfer-roi-sort';

describe('sortRows', () => {
  const rows = [
    { name: 'Émile', value: 5 },
    { name: 'adam', value: null },
    { name: 'Zoé', value: 20 },
    { name: 'Bruno', value: 0 }
  ];

  it('sorts high to low or low to high with unknown values last', () => {
    expect(sortRows(rows, (r) => r.value, 'desc').map((r) => r.name)).toEqual(['Zoé', 'Émile', 'Bruno', 'adam']);
    expect(sortRows(rows, (r) => r.value, 'asc').map((r) => r.name)).toEqual(['Bruno', 'Émile', 'Zoé', 'adam']);
  });

  it('sorts names in French order, ignoring case and accents', () => {
    expect(sortRows(rows, (r) => r.name, 'asc').map((r) => r.name)).toEqual(['adam', 'Bruno', 'Émile', 'Zoé']);
  });

  it('does not change the input', () => {
    sortRows(rows, (r) => r.value, 'desc');
    expect(rows[0].name).toBe('Émile');
  });
});

describe('nextSort', () => {
  it('starts a new number column high to low and a name column A to Z', () => {
    expect(nextSort(null, 'feePaid')).toEqual({ key: 'feePaid', direction: 'desc' });
    expect(nextSort({ key: 'feePaid', direction: 'desc' }, 'player')).toEqual({ key: 'player', direction: 'asc' });
  });

  it('flips the direction when the same column is clicked again', () => {
    expect(nextSort({ key: 'feePaid', direction: 'desc' }, 'feePaid')).toEqual({ key: 'feePaid', direction: 'asc' });
    expect(nextSort({ key: 'feePaid', direction: 'asc' }, 'feePaid')).toEqual({ key: 'feePaid', direction: 'desc' });
  });
});
