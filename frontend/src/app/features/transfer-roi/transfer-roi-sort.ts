/**
 * Returns a copy of the rows ordered by current market value, highest first.
 * Players without a current value go last and keep their original order.
 */
export function byCurrentMarketValue<T extends { currentMarketValue: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.currentMarketValue === null && b.currentMarketValue === null) return 0;
    if (a.currentMarketValue === null) return 1;
    if (b.currentMarketValue === null) return -1;
    return b.currentMarketValue - a.currentMarketValue;
  });
}
