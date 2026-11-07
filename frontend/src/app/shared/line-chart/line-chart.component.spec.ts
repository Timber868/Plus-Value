import { ComponentFixture, TestBed } from '@angular/core/testing';

import { appConfig } from '../../app.config';
import { LineChartComponent, formatChartValue } from './line-chart.component';

describe('formatChartValue', () => {
  beforeEach(() => {
    // Registers the fr-FR locale data
    TestBed.configureTestingModule({ providers: appConfig.providers });
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

  it('formats y-axis ticks as French euro amounts', () => {
    const chart = fixture.componentInstance.chartInstance;
    const callback = chart?.options.scales?.['y']?.ticks?.callback as (value: number) => string;

    expect(callback.call(null as never, 15000000)).toBe('15 000 000 €');
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

  it('destroys the chart with the component', () => {
    const chart = fixture.componentInstance.chartInstance;
    const destroy = spyOn(chart!, 'destroy').and.callThrough();

    fixture.destroy();

    expect(destroy).toHaveBeenCalled();
  });
});
