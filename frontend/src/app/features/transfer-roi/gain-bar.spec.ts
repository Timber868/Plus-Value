import { barPercent, maxAbs } from './gain-bar';

describe('gain bars', () => {
  it('finds the largest absolute gain, skipping unknown values', () => {
    expect(maxAbs([3, null, -8, 5])).toBe(8);
    expect(maxAbs([null])).toBe(0);
  });

  it('sizes a bar against the largest gain, with a visible minimum', () => {
    expect(barPercent(-8, 8)).toBe(100);
    expect(barPercent(4, 8)).toBe(50);
    expect(barPercent(0.01, 8)).toBe(4);
    expect(barPercent(0, 8)).toBe(0);
    expect(barPercent(null, 8)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
  });
});
