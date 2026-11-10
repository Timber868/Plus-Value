import {
  Component,
  ElementRef,
  LOCALE_ID,
  OnDestroy,
  effect,
  inject,
  input,
  viewChild
} from '@angular/core';
import { formatCurrency, formatDate, formatNumber } from '@angular/common';
import { firstOfMonth } from '../french';
import { compactEuro } from '../money/compact-euro';
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';

// Register only the Chart.js pieces a line chart needs, so the rest is tree-shaken
Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend, Filler);

/**
 * One line on the chart. `data` lines up with the chart's `labels`; null leaves a gap.
 * With `times` (UTC timestamps in milliseconds, one per value) the chart draws a
 * time axis instead, so points sit at their real dates and gaps keep their length.
 */
export interface LineSeries {
  label: string;
  data: (number | null)[];
  times?: number[];
  /** False draws only markers, for example events placed on another line */
  showLine?: boolean;
  /** Tooltip text per point, replacing the formatted value where set */
  pointLabels?: (string | null)[];
}

/** Matchday colours, used in order for each series: pitch green, then amber (transfer markers), navy blue and red */
const SERIES_COLORS = ['#0f8a4b', '#d98b00', '#1f5fbf', '#e30613'];

/**
 * Formats a chart value for the given locale: euros without decimals (45 000 000 €)
 * or a plain number (1 234,5).
 */
export function formatChartValue(value: number, locale: string, unit: 'euro' | 'number'): string {
  return unit === 'euro'
    ? formatCurrency(value, locale, '€', 'EUR', '1.0-0')
    : formatNumber(value, locale, '1.0-2');
}

/** Tick text on a time axis, for example "juil. 2017" */
export function formatTimeTick(time: number, locale: string): string {
  return formatDate(time, 'MMM y', locale, 'UTC');
}

/**
 * Tick positions for a time axis: the first day of a month, every 1, 2, 5 or 10 years
 * (or every 3 or 6 months for a short span), so there are at most `maxTicks` of them
 * and the labels never repeat a month.
 */
export function timeTicks(min: number, max: number, maxTicks = 8): number[] {
  const start = new Date(min);
  const first = start.getUTCFullYear() * 12 + start.getUTCMonth() + (start.getUTCDate() > 1 ? 1 : 0);
  const end = new Date(max);
  const last = end.getUTCFullYear() * 12 + end.getUTCMonth();
  const months = [1, 3, 6, 12, 24, 60, 120].find((m) => Math.floor((last - first) / m) + 1 <= maxTicks) ?? 120;
  const ticks: number[] = [];
  // Align on January for yearly steps and on quarters otherwise
  for (let m = Math.ceil(first / Math.min(months, 12)) * Math.min(months, 12); m <= last; m += months) {
    ticks.push(Date.UTC(Math.floor(m / 12), m % 12, 1));
  }
  return ticks;
}

/**
 * Shared line chart built on Chart.js. Give it x-axis labels and one or more series,
 * or series with `times` for a time axis; values on the axis and in tooltips use the
 * app locale (fr-FR).
 */
@Component({
  selector: 'app-line-chart',
  template: `<div class="chart-box"><canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas></div>`,
  styles: `
    .chart-box {
      position: relative;
      height: 320px;
    }
  `
})
export class LineChartComponent implements OnDestroy {
  /** X-axis labels, for example formatted dates; not needed when the series have `times` */
  readonly labels = input<string[]>([]);
  readonly series = input.required<LineSeries[]>();
  /** Text read by screen readers, describing what the chart shows */
  readonly ariaLabel = input.required<string>();
  /** 'euro' formats values as euro amounts, 'number' as plain numbers */
  readonly unit = input<'euro' | 'number'>('euro');

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly locale = inject(LOCALE_ID);
  private chart?: Chart<'line'>;

  constructor() {
    // Rebuild the chart whenever an input changes
    effect(() => {
      const labels = this.labels();
      const series = this.series();
      const unit = this.unit();
      this.chart?.destroy();
      this.chart = this.createChart(labels, series, unit);
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  /** The current Chart.js instance, exposed for tests */
  get chartInstance(): Chart<'line'> | undefined {
    return this.chart;
  }

  private createChart(labels: string[], series: LineSeries[], unit: 'euro' | 'number'): Chart<'line'> {
    const format = (value: number) => formatChartValue(value, this.locale, unit);
    const timeAxis = series.some((s) => s.times);
    const allTimes = series.flatMap((s) => s.times ?? []);
    return new Chart(this.canvas().nativeElement, {
      type: 'line',
      data: {
        labels: timeAxis ? undefined : labels,
        datasets: series.map((s, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          const line = s.showLine !== false;
          return {
            label: s.label,
            // On a time axis each value carries its own date
            data: (timeAxis ? s.data.map((y, j) => ({ x: s.times?.[j] ?? NaN, y })) : s.data) as number[],
            borderColor: color,
            // A light area under each line, a solid colour for markers
            backgroundColor: line ? `${color}1f` : color,
            fill: line ? 'origin' : false,
            // Straight segments, so markers placed between two valuations sit on the line and no curve invents values
            tension: 0,
            spanGaps: true,
            ...(line ? {} : { showLine: false, pointStyle: 'triangle', pointRadius: 8, pointHoverRadius: 10 })
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        locale: this.locale,
        // Datasets on a time axis do not share indexes, so the tooltip picks the nearest date instead
        interaction: timeAxis ? { mode: 'nearest', axis: 'x', intersect: false } : { mode: 'index', intersect: false },
        plugins: {
          legend: { display: series.length > 1, labels: { usePointStyle: true } },
          tooltip: {
            // Points without a value (gaps, indexes without a marker) get no tooltip line
            filter: (item) => item.raw !== null && item.raw !== undefined,
            callbacks: {
              ...(timeAxis
                ? { title: (items) => (items[0] ? firstOfMonth(formatDate(items[0].parsed.x ?? 0, 'd MMMM y', this.locale, 'UTC')) : '') }
                : {}),
              label: (ctx) =>
                series[ctx.datasetIndex]?.pointLabels?.[ctx.dataIndex] ??
                `${ctx.dataset.label} : ${format(ctx.parsed.y ?? 0)}`
            }
          }
        },
        scales: {
          ...(timeAxis
            ? {
                x: {
                  type: 'linear',
                  // The axis runs from the first to the last date, not to rounded numbers beyond them
                  min: Math.min(...allTimes),
                  max: Math.max(...allTimes),
                  // About one tick per 90 px, so labels stay level on a phone
                  afterBuildTicks: (scale) => {
                    const maxTicks = Math.max(3, Math.min(8, Math.floor(scale.width / 90)));
                    scale.ticks = timeTicks(scale.min, scale.max, maxTicks).map((value) => ({ value }));
                  },
                  ticks: { maxRotation: 0, callback: (value) => formatTimeTick(Number(value), this.locale) }
                }
              }
            : {}),
          // Start at zero so a change in value is not exaggerated; short euro labels keep the axis narrow
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) =>
                unit === 'euro' ? compactEuro(Number(value), this.locale) : format(Number(value))
            }
          }
        }
      }
    });
  }
}
