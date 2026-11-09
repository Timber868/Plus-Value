import { formatCurrency, formatDate } from '@angular/common';

import { firstOfMonth, ofName } from '../../shared/french';
import { LineSeries } from '../../shared/line-chart/line-chart.component';
import { MarketValuePoint, PlayerTransfer } from './models/player.model';

/**
 * Describes a transfer as one French sentence, for example
 * "Transfert du 5 juillet 2017 de l’Olympique Lyonnais vers Arsenal FC pour 53 000 000 €."
 */
export function describeTransfer(transfer: PlayerTransfer, locale: string): string {
  const date = firstOfMonth(formatDate(transfer.date, 'd MMMM y', locale, 'UTC'));
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
 * Builds a marker-only series that puts each transfer on the market value line at
 * its own date, for a chart with a time axis. Its height is read off the line:
 * the value straight between the valuations just before and just after it.
 * Transfers before the first or after the last valuation are left out, since the
 * line does not reach them. Transfers on the same day share one marker and one tooltip.
 */
export function buildTransferSeries(
  marketValues: MarketValuePoint[],
  transfers: PlayerTransfer[],
  locale: string
): LineSeries {
  const points = marketValues.map((point) => ({ time: new Date(point.date).getTime(), value: point.value }));
  const times: number[] = [];
  const data: number[] = [];
  const pointLabels: string[] = [];

  const sorted = [...transfers].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const transfer of sorted) {
    const time = new Date(transfer.date).getTime();
    if (points.length === 0 || time < points[0].time || time > points[points.length - 1].time) continue;

    const sentence = describeTransfer(transfer, locale);
    const last = times.length - 1;
    if (last >= 0 && times[last] === time) {
      pointLabels[last] = `${pointLabels[last]} ${sentence}`;
      continue;
    }

    const after = points.findIndex((point) => point.time >= time);
    const next = points[after];
    const previous = points[Math.max(after - 1, 0)];
    const share = next.time === previous.time ? 1 : (time - previous.time) / (next.time - previous.time);
    times.push(time);
    data.push(Math.round(previous.value + (next.value - previous.value) * share));
    pointLabels.push(sentence);
  }

  return { label: 'Transferts', data, times, showLine: false, pointLabels };
}
