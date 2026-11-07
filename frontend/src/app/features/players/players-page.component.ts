import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';

import { PlayerSearchResult } from './models/player.model';
import { PlayerService } from './services/player.service';

/** The API needs at least this many characters to search */
export const MIN_QUERY_LENGTH = 2;
/** Wait this long after the last keystroke before searching */
export const SEARCH_DEBOUNCE_MS = 300;

type SearchState = 'idle' | 'loading' | 'done' | 'error';

/**
 * Player search page (KF-1): type a name, see matching players, open a player's page.
 */
@Component({
  selector: 'app-players-page',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './players-page.component.html',
  styleUrl: './players-page.component.scss'
})
export class PlayersPageComponent {
  private readonly playerService = inject(PlayerService);

  readonly state = signal<SearchState>('idle');
  readonly results = signal<PlayerSearchResult[]>([]);

  private readonly queries = new Subject<string>();

  constructor() {
    this.queries
      .pipe(
        map((query) => query.trim()),
        debounceTime(SEARCH_DEBOUNCE_MS),
        tap((query) => this.state.set(query.length < MIN_QUERY_LENGTH ? 'idle' : 'loading')),
        // switchMap drops the answer to an older query when a newer one starts
        switchMap((query) => {
          if (query.length < MIN_QUERY_LENGTH) return of(null);
          return this.playerService.search(query).pipe(catchError(() => of('error' as const)));
        }),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe((outcome) => {
        if (outcome === null) {
          this.results.set([]);
        } else if (outcome === 'error') {
          this.results.set([]);
          this.state.set('error');
        } else {
          this.results.set(outcome);
          this.state.set('done');
        }
      });
  }

  /** Called on every keystroke in the search box */
  onQuery(value: string): void {
    this.queries.next(value);
  }
}
