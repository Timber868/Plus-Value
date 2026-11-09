import { formatCurrency, formatDate } from '@angular/common';

import { ofName } from '../../shared/french';
import { LineSeries } from '../../shared/line-chart/line-chart.component';
import { MarketValuePoint, PlayerTransfer } from './models/player.model';

/**
 * Describes a transfer as one French sentence, for example
 * "Transfert du 5 juillet 2017 d'Olympique Lyonnais vers Arsenal FC pour 53 000 000 €."
 */
export function describeTransfer(transfer: PlayerTransfer, locale: string): string {
  const date = formatDate(transfer.date, 'd MMMM y', locale, 'UTC');
  const clubs = transfer.fromClub
    ? `${ofName(transfer.fromClub.name)} vers ${transfer.toClub.name}`
    : `vers ${transfer.toClub.name}`;
  let fee: string;
  if (transfer.fee === null) fee = ', montant non communiqué';
  else if (transfer.fee === 0) fee = ', sans indemnité de transfert';
  else fee = ` pour ${formatCurrency(transfer.fee, locale, '€', 'EUR', '1.0-0')}`;
  return `Transfert du ${date} ${clubs}${fee}.`;
}

/**
 * Builds a marker-only series that puts each transfer on the market value line.
 * The chart has one x-axis label per valuation, so a transfer sits on the
 * valuation closest in time and takes its value. Transfers before the first or
 * after the last valuation are left out, since no point on the line matches them.
 * Transfers landing on the same valuation share one marker and one tooltip.
 */
export function buildTransferSeries(
  marketValues: MarketValuePoint[],
  transfers: PlayerTransfer[],
  locale: string
): LineSeries {
  const times = marketValues.map((point) => new Date(point.date).getTime());
  const data: (number | null)[] = marketValues.map(() => null);
  const pointLabels: (string | null)[] = marketValues.map(() => null);

  for (const transfer of transfers) {
    const time = new Date(transfer.date).getTime();
    if (times.length === 0 || time < times[0] || time > times[times.length - 1]) continue;

    let nearest = 0;
    times.forEach((t, i) => {
      if (Math.abs(t - time) < Math.abs(times[nearest] - time)) nearest = i;
    });

    const sentence = describeTransfer(transfer, locale);
    data[nearest] = marketValues[nearest].value;
    pointLabels[nearest] = pointLabels[nearest] ? `${pointLabels[nearest]} ${sentence}` : sentence;
  }

  return { label: 'Transferts', data, showLine: false, pointLabels };
}
