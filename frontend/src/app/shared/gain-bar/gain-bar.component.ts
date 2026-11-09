import { Component, computed, input } from '@angular/core';

/** Shares of a gain bar, in percent of its full length */
export interface GainBarParts {
  /** Blue part: what was paid (gain) or what is left of it (loss) */
  base: number;
  /** Green part: the value gained since */
  gain: number;
  /** Red part: the value lost since */
  loss: number;
}

/**
 * Splits a player's bar (Tim, Nov 9). The full bar is the player's value:
 * - after a gain, his value now: blue is what was paid, green what he gained since;
 * - after a loss, what was paid for him: blue is what he is worth now, red what was lost.
 * Null when the amounts are unknown or both are 0.
 *
 * @param paid what the club paid (0 for a free signing or a player it formed)
 * @param gain value now minus what was paid
 */
export function gainBarParts(paid: number | null, gain: number | null): GainBarParts | null {
  if (paid === null || gain === null) return null;
  const before = Math.max(paid, 0);
  const after = before + gain;
  const full = Math.max(before, after);
  if (full <= 0) return null;
  const pct = (v: number) => Math.round((Math.max(v, 0) / full) * 1000) / 10;
  return gain >= 0
    ? { base: pct(before), gain: pct(gain), loss: 0 }
    : { base: pct(after), gain: 0, loss: pct(-gain) };
}

/**
 * A thin bar under a gain, the length of the player's value, split in blue
 * (what was paid, or what is left after a loss) and green or red (the value
 * gained or lost since). Decorative: the amounts are written next to it.
 */
@Component({
  selector: 'app-gain-bar',
  template: `
    @if (parts(); as p) {
      <span class="bar" aria-hidden="true">
        @if (p.base > 0) {
          <span class="base" [style.width.%]="p.base"></span>
        }
        @if (p.gain > 0) {
          <span class="gain" [style.width.%]="p.gain"></span>
        }
        @if (p.loss > 0) {
          <span class="loss" [style.width.%]="p.loss"></span>
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .bar {
      display: flex;
      gap: 2px;
      width: 100%;
      min-width: 5rem;
      height: 6px;
      margin-top: 0.35rem;
    }

    .bar > span {
      display: block;
      height: 100%;
      border-radius: 3px;
    }

    .base {
      background: var(--pv-series-1, #2a78d6);
    }

    .gain {
      background: var(--pv-good, #1a7f4b);
    }

    .loss {
      background: var(--pv-bad, #c0302f);
    }
  `
})
export class GainBarComponent {
  /** What the club paid for the player */
  readonly paid = input<number | null>(null);
  /** Value now minus what was paid */
  readonly gain = input<number | null>(null);

  readonly parts = computed(() => gainBarParts(this.paid(), this.gain()));
}
