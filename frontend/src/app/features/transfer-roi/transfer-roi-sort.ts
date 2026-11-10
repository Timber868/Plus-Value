import { ClubSale, ClubTransferRoi } from './models/transfer-roi.model';

export type SortDirection = 'asc' | 'desc';

/** Columns of the purchases table that can be sorted */
export type PurchaseSortKey =
  | 'player'
  | 'currentMarketValue'
  | 'date'
  | 'fromClub'
  | 'feePaid'
  | 'marketValueAtSigning'
  | 'soldFor'
  | 'exitValue'
  | 'valueGain'
  | 'resaleGain'
  | 'roiPercent';

/** Columns of the sales table that can be sorted */
export type SaleSortKey = 'player' | 'date' | 'toClub' | 'soldFor' | 'gain';

/** Current sort of a table */
export interface TableSort<K extends string> {
  key: K;
  direction: SortDirection;
}

type SortValue = number | string | null;

const PURCHASE_VALUES: Record<PurchaseSortKey, (row: ClubTransferRoi) => SortValue> = {
  player: (r) => r.player.name,
  currentMarketValue: (r) => r.currentMarketValue,
  date: (r) => new Date(r.date).getTime(),
  fromClub: (r) => r.fromClub?.name ?? null,
  feePaid: (r) => r.feePaid,
  marketValueAtSigning: (r) => r.marketValueAtSigning?.value ?? null,
  soldFor: (r) => r.soldFor,
  exitValue: (r) => r.exit.value,
  valueGain: (r) => r.valueGain,
  resaleGain: (r) => r.resaleGain,
  roiPercent: (r) => r.roiPercent
};

const SALE_VALUES: Record<SaleSortKey, (sale: ClubSale) => SortValue> = {
  player: (s) => s.player.name,
  date: (s) => new Date(s.date).getTime(),
  toClub: (s) => s.toClub?.name ?? null,
  soldFor: (s) => s.soldFor,
  gain: (s) => s.gain
};

/** Text columns start A to Z; every other column starts high to low */
export const TEXT_KEYS: ReadonlySet<string> = new Set(['player', 'fromClub', 'toClub']);

/**
 * Returns a sorted copy of the rows. Unknown values (null) always go last,
 * whatever the direction, and keep their original order. Names compare in
 * French order, ignoring case and accents.
 */
export function sortRows<T>(rows: T[], value: (row: T) => SortValue, direction: SortDirection): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
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

export function sortPurchases(rows: ClubTransferRoi[], sort: TableSort<PurchaseSortKey>): ClubTransferRoi[] {
  return sortRows(rows, PURCHASE_VALUES[sort.key], sort.direction);
}

/** Sales sort by the player's current market value until a column is picked */
export function sortSales(rows: ClubSale[], sort: TableSort<SaleSortKey> | null): ClubSale[] {
  return sort
    ? sortRows(rows, SALE_VALUES[sort.key], sort.direction)
    : sortRows(rows, (s) => s.currentMarketValue, 'desc');
}

/**
 * The sort after clicking a column: the same column flips the direction, a
 * new column starts high to low (A to Z for names).
 */
export function nextSort<K extends string>(current: TableSort<K> | null, key: K): TableSort<K> {
  if (current && current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: TEXT_KEYS.has(key) ? 'asc' : 'desc' };
}

/** A sort written in the page URL, for example "gain-desc" */
export function formatSort(sort: TableSort<string> | null): string | null {
  return sort ? `${sort.key}-${sort.direction}` : null;
}

/** Reads a purchases sort from the page URL; null when missing or unknown */
export function parsePurchaseSort(text: string | null): TableSort<PurchaseSortKey> | null {
  return parseSort(text, PURCHASE_VALUES);
}

/** Reads a sales sort from the page URL; null when missing or unknown */
export function parseSaleSort(text: string | null): TableSort<SaleSortKey> | null {
  return parseSort(text, SALE_VALUES);
}

function parseSort<K extends string>(text: string | null, columns: Record<K, unknown>): TableSort<K> | null {
  const match = /^(\w+)-(asc|desc)$/.exec(text ?? '');
  if (!match || !Object.prototype.hasOwnProperty.call(columns, match[1])) return null;
  return { key: match[1] as K, direction: match[2] as SortDirection };
}
