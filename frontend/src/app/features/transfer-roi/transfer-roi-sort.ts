import { ClubTransferRoi } from './models/transfer-roi.model';

/** Table columns the user can sort by */
export type SortKey = 'date' | 'player' | 'feePaid' | 'exit' | 'gain' | 'roiPercent';
export type SortDirection = 'asc' | 'desc';

function sortValue(row: ClubTransferRoi, key: SortKey): number | string | null {
  switch (key) {
    case 'date':
      return new Date(row.date).getTime();
    case 'player':
      return row.player.name;
    case 'feePaid':
      return row.feePaid;
    case 'exit':
      return row.exit.value;
    case 'gain':
      return row.gain;
    case 'roiPercent':
      return row.roiPercent;
  }
}

/**
 * Returns a sorted copy of the rows. Unknown values (null) always go last,
 * whatever the direction, so the known figures stay at the top. Names
 * compare in French order, ignoring case and accents.
 */
export function sortTransfers(rows: ClubTransferRoi[], key: SortKey, direction: SortDirection): ClubTransferRoi[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    const order =
      typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb, 'fr', { sensitivity: 'base' })
        : (va as number) - (vb as number);
    return order * sign;
  });
}
