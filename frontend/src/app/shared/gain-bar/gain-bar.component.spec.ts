import { TestBed } from '@angular/core/testing';

import { GainBarComponent, gainBarParts } from './gain-bar.component';

describe('gainBarParts', () => {
  it('after a gain, fills the bar with what was paid in blue and the gain in green', () => {
    // Paid 10M, worth 30M now
    expect(gainBarParts(10_000_000, 20_000_000)).toEqual({ base: 33.3, gain: 66.7, loss: 0 });
  });

  it('after a loss, shows what he is worth now in blue and the loss in red', () => {
    // Paid 20M, worth 15M now
    expect(gainBarParts(20_000_000, -5_000_000)).toEqual({ base: 75, gain: 0, loss: 25 });
  });

  it('is all green for a free signing or a player the club formed', () => {
    expect(gainBarParts(0, 8_000_000)).toEqual({ base: 0, gain: 100, loss: 0 });
  });

  it('is all red when the player lost all his value', () => {
    expect(gainBarParts(5_000_000, -5_000_000)).toEqual({ base: 0, gain: 0, loss: 100 });
  });

  it('draws nothing when an amount is unknown or everything is 0', () => {
    expect(gainBarParts(null, 5)).toBeNull();
    expect(gainBarParts(5, null)).toBeNull();
    expect(gainBarParts(0, 0)).toBeNull();
  });
});

describe('GainBarComponent', () => {
  it('draws the blue and green parts at their widths', () => {
    const fixture = TestBed.createComponent(GainBarComponent);
    fixture.componentRef.setInput('paid', 10_000_000);
    fixture.componentRef.setInput('gain', 10_000_000);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector<HTMLElement>('.base')?.style.width).toBe('50%');
    expect(el.querySelector<HTMLElement>('.gain')?.style.width).toBe('50%');
    expect(el.querySelector('.loss')).toBeNull();
  });
});
