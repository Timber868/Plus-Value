import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { ClubCrestComponent } from '../../shared/club-crest/club-crest.component';
import { DePipe, PremierPipe } from '../../shared/french';
import { DEFAULT_LEAGUE } from '../../shared/league-tabs/league-tabs.component';
import { CompactEuroPipe } from '../../shared/money/compact-euro';
import { positionDescription } from '../../shared/positions';
import { SquadValueResponse } from '../squad-value/models/squad-value.model';
import { SquadValueService } from '../squad-value/services/squad-value.service';
import { ClubOption } from '../transfer-roi/models/transfer-roi.model';
import { TransferRoiService } from '../transfer-roi/services/transfer-roi.service';
import { PlayerSearchResult } from './models/player.model';
import { PlayerService } from './services/player.service';

/** The API needs at least this many characters to search */
export const MIN_QUERY_LENGTH = 2;
/** Wait this long after the last keystroke before searching */
export const SEARCH_DEBOUNCE_MS = 300;

type SearchState = 'idle' | 'loading' | 'done' | 'error';

/** Club whose most valuable players are shown before the reader types */
const FEATURED_CLUB = /lyon/i;
/** Number of players shown before the reader types */
export const FEATURED_COUNT = 10;

/** The most valuable players of the featured club's latest squad */
export interface FeaturedSquad {
  club: ClubOption;
  squad: SquadValueResponse;
}

/**
 * Player search page (KF-1): type a name, see matching players, open a player's page.
 * Before the reader types, it lists the most valuable players of Lyon's latest squad.
 */
@Component({
  selector: 'app-players-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, PremierPipe, DePipe, CompactEuroPipe, ClubCrestComponent],
  templateUrl: './players-page.component.html',
  styleUrl: './players-page.component.scss'
})
export class PlayersPageComponent {
  private readonly playerService = inject(PlayerService);
  private readonly pickerService = inject(TransferRoiService);
  private readonly squadService = inject(SquadValueService);
  private readonly destroyRef = inject(DestroyRef);

  readonly positionDescription = positionDescription;
  readonly state = signal<SearchState>('idle');
  readonly results = signal<PlayerSearchResult[]>([]);

  /** Null while loading, or when the featured squad cannot be shown; the search still works */
  readonly featured = signal<FeaturedSquad | null>(null);

  private readonly queries = new Subject<string>();

  constructor() {
    this.loadFeatured();

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
        takeUntilDestroyed(this.destroyRef)
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

  /**
   * Loads the latest Ligue 1 season's squad of the featured club, the same
   * data as the squad value page. Any failure hides the list.
   */
  private loadFeatured(): void {
    forkJoin({
      clubs: this.pickerService.getClubs(DEFAULT_LEAGUE),
      seasons: this.pickerService.getSeasons(DEFAULT_LEAGUE)
    })
      .pipe(
        switchMap(({ clubs, seasons }) => {
          const club = clubs.find((c) => FEATURED_CLUB.test(c.name));
          // Seasons come newest first
          const season = seasons[0];
          if (!club || !season) return of(null);
          return this.squadService.getSquadValue(club.id, season.id).pipe(
            map((squad): FeaturedSquad => ({
              club,
              squad: { ...squad, players: squad.players.filter((p) => p.marketValue).slice(0, FEATURED_COUNT) }
            }))
          );
        }),
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((featured) => this.featured.set(featured?.squad.players.length ? featured : null));
  }
}
