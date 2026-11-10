import { ComponentFixture, TestBed } from '@angular/core/testing';

import { appConfig } from '../../app.config';
import { LineChartComponent, formatChartValue, timeTicks } from './line-chart.component';

describe('formatChartValue', () => {
  beforeEach(() => {
    // Registers the fr-FR locale data
    TestBed.configureTestingModule({ providers: appConfig.providers });
  });

  it('places time ticks on month starts, at most eight of them', () => {
    expect(timeTicks(Date.UTC(2016, 5, 1), Date.UTC(2024, 0, 15))).toEqual(
      [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((year) => Date.UTC(year, 0, 1))
    );
    expect(timeTicks(Date.UTC(2010, 0, 1), Date.UTC(2026, 0, 1))).toEqual(
      [2010, 2015, 2020, 2025].map((year) => Date.UTC(year, 0, 1))
    );
    expect(timeTicks(Date.UTC(2024, 1, 10), Date.UTC(2024, 9, 1))).toEqual(
      [2, 3, 4, 5, 6, 7, 8, 9].map((month) => Date.UTC(2024, month, 1))
    );
  });

  it('formats euro amounts in French without decimals', () => {
    expect(formatChartValue(45000000, 'fr-FR', 'euro')).toBe('45 000 000 €');
  });

  it('formats plain numbers in French', () => {
    expect(formatChartValue(1234.5, 'fr-FR', 'number')).toBe('1 234,5');
  });
});

describe('LineChartComponent', () => {
  let fixture: ComponentFixture<LineChartComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LineChartComponent],
      providers: appConfig.providers
    });
    fixture = TestBed.createComponent(LineChartComponent);
    fixture.componentRef.setInput('labels', ['janv. 2024', 'juil. 2024']);
    fixture.componentRef.setInput('series', [{ label: 'Valeur marchande', data: [10000000, 15000000] }]);
    fixture.componentRef.setInput('ariaLabel', 'Évolution de la valeur marchande du joueur.');
    fixture.detectChanges();
  });

  it('renders a Chart.js line chart with the given data', () => {
    const chart = fixture.componentInstance.chartInstance;

    expect(chart).toBeDefined();
    expect(chart?.data.labels).toEqual(['janv. 2024', 'juil. 2024']);
    expect(chart?.data.datasets[0].data).toEqual([10000000, 15000000]);
  });

  it('labels the canvas for screen readers', () => {
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    expect(canvas.getAttribute('role')).toBe('img');
    expect(canvas.getAttribute('aria-label')).toBe('Évolution de la valeur marchande du joueur.');
  });

  it('formats y-axis ticks as short French euro amounts and starts at zero', () => {
    const chart = fixture.componentInstance.chartInstance;
    const y = chart?.options.scales?.['y'] as { beginAtZero?: boolean; ticks?: { callback?: unknown } };
    const callback = y.ticks?.callback as (value: number) => string;

    expect(callback.call(null as never, 15000000)).toBe('15\u00a0M€');
    expect(callback.call(null as never, 2500000)).toBe('2,5\u00a0M€');
    expect(y.beginAtZero).toBeTrue();
  });

  it('rebuilds the chart when the series change', () => {
    const first = fixture.componentInstance.chartInstance;

    fixture.componentRef.setInput('series', [
      { label: 'Joueur A', data: [1, 2] },
      { label: 'Joueur B', data: [3, null] }
    ]);
    fixture.detectChanges();

    const second = fixture.componentInstance.chartInstance;
    expect(second).not.toBe(first);
    expect(second?.data.datasets.length).toBe(2);
    expect(second?.options.plugins?.legend?.display).toBeTrue();
  });

  it('draws a time axis with French month ticks when the series have dates', () => {
    fixture.componentRef.setInput('series', [
      { label: 'Valeur marchande', data: [10000000, 15000000], times: [Date.UTC(2016, 5, 1), Date.UTC(2024, 0, 15)] },
      { label: 'Transferts', data: [12000000], times: [Date.UTC(2017, 6, 5)], showLine: false }
    ]);
    fixture.detectChanges();

    const chart = fixture.componentInstance.chartInstance;
    const x = chart?.options.scales?.['x'] as { type?: string; ticks?: { callback?: unknown } };
    const callback = x.ticks?.callback as (value: number) => string;

    expect(x.type).toBe('linear');
    expect(chart?.data.datasets[1].data).toEqual([{ x: Date.UTC(2017, 6, 5), y: 12000000 }] as never);
    expect(callback.call(null as never, Date.UTC(2017, 6, 1))).toBe('juil. 2017');
    expect(chart?.data.datasets[0].fill).toBe('origin');
    expect(chart?.data.datasets[1].fill).toBeFalse();
  });

  it('destroys the chart with the component', () => {
    const chart = fixture.componentInstance.chartInstance;
    const destroy = spyOn(chart!, 'destroy').and.callThrough();

    fixture.destroy();

    expect(destroy).toHaveBeenCalled();
  });
});
