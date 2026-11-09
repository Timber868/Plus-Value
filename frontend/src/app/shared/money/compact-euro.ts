import { formatNumber } from '@angular/common';
import { inject, LOCALE_ID, Pipe, PipeTransform } from '@angular/core';

/**
 * Short euro amount for headline figures and chart axes: "131,8 M€", "850 k€", "900 €".
 * Tables and tooltips keep the full amount.
 */
export function compactEuro(value: number, locale: string): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return `${formatNumber(value / 1e6, locale, '1.0-1')} M€`;
  if (abs >= 1e3) return `${formatNumber(value / 1e3, locale, '1.0-0')} k€`;
  return `${formatNumber(value, locale, '1.0-0')} €`;
}

@Pipe({ name: 'compactEuro' })
export class CompactEuroPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : compactEuro(value, this.locale);
  }
}
