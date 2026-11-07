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
import { formatCurrency, formatNumber } from '@angular/common';
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

/** One line on the chart. `data` lines up with the chart's `labels`; null leaves a gap. */
export interface LineSeries {
  label: string;
  data: (number | null)[];
}

/** Brand-neutral colors, used in order for each series */
const SERIES_COLORS = ['#1f5fbf', '#e30613', '#2e8b57', '#d98b00'];

/**
 * Formats a chart value for the given locale: euros without decimals (45 000 000 €)
 * or a plain number (1 234,5).
 */
export function formatChartValue(value: number, locale: string, unit: 'euro' | 'number'): string {
  return unit === 'euro'
    ? formatCurrency(value, locale, '€', 'EUR', '1.0-0')
    : formatNumber(value, locale, '1.0-2');
}

/**
 * Shared line chart built on Chart.js. Give it x-axis labels and one or more series;
 * values on the axis and in tooltips use the app locale (fr-FR).
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
  /** X-axis labels, for example formatted dates */
  readonly labels = input.required<string[]>();
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
    return new Chart(this.canvas().nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: series.map((s, i) => ({
          label: s.label,
          data: s.data,
          borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
          backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length],
          tension: 0.2,
          spanGaps: true
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        locale: this.locale,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: series.length > 1 },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label} : ${format(ctx.parsed.y ?? 0)}`
            }
          }
        },
        scales: {
          y: { ticks: { callback: (value) => format(Number(value)) } }
        }
      }
    });
  }
}
