/** Largest absolute value of a column, skipping unknown values; 0 when none is known */
export function maxAbs(values: (number | null)[]): number {
  return values.reduce<number>((max, v) => (v === null ? max : Math.max(max, Math.abs(v))), 0);
}

/**
 * Width of a gain bar in percent of the largest gain of its column. Any
 * non-zero gain gets at least a sliver so it stays visible.
 */
export function barPercent(value: number | null, max: number): number {
  if (value === null || value === 0 || max === 0) return 0;
  return Math.max(4, Math.round((Math.abs(value) / max) * 100));
}
