import { Component, input, output } from '@angular/core';

/** The French leagues offered as tabs, top tier first */
export const FRENCH_LEAGUES = [
  { id: 'FR1', name: 'Ligue 1' },
  { id: 'FR2', name: 'Ligue 2' },
  { id: 'FR3', name: 'Ligue 3' }
] as const;

/** League shown first */
export const DEFAULT_LEAGUE = 'FR1';

/**
 * Tabs to switch between Ligue 1, Ligue 2 and Ligue 3. A league whose data is
 * not imported yet still has its tab; the page then says it has no clubs.
 */
@Component({
  selector: 'app-league-tabs',
  template: `
    <div class="tabs" role="tablist" aria-label="Championnat">
      @for (league of leagues; track league.id) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="league.id === selected()"
          [class.active]="league.id === selected()"
          (click)="selectedChange.emit(league.id)"
        >
          {{ league.name }}
        </button>
      }
    </div>
  `,
  styles: `
    .tabs {
      display: flex;
      gap: 0.35rem;
      padding: 0.3rem;
      background: var(--pv-night);
      border-radius: 999px;
      width: fit-content;
      max-width: 100%;
      overflow-x: auto;
    }

    button {
      flex: none;
      padding: 0.45rem 1.1rem;
      font-family: var(--pv-display);
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: #c9d6e8;
      background: transparent;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      transition: background-color 150ms ease, color 150ms ease;
    }

    button:hover {
      color: #fff;
      background: rgb(255 255 255 / 8%);
    }

    button.active {
      color: var(--pv-night);
      background: var(--pv-lime);
    }

    button:focus-visible {
      outline: 2px solid var(--pv-lime);
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      button {
        transition: none;
      }
    }
  `
})
export class LeagueTabsComponent {
  readonly leagues = FRENCH_LEAGUES;
  /** Competition id of the selected league, for example "FR1" */
  readonly selected = input<string | null>(null);
  readonly selectedChange = output<string>();
}
