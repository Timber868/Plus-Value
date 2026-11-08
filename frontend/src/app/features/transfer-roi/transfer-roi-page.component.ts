import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { ClubOption, ClubRoiResponse, SeasonOption } from './models/transfer-roi.model';
import { TransferRoiService } from './services/transfer-roi.service';
import { SortDirection, SortKey, sortTransfers } from './transfer-roi-sort';

type LoadState = 'loading' | 'ready' | 'error';

/** Club shown first when it is in the list */
const DEFAULT_CLUB = /lyon/i;

/**
 * Club transfer ROI dashboard (KF-2): club and season pickers, club totals
 * and a sortable table of the club's signings with their return. Loans out
 * do not count as a departure; their fees are part of the exit value.
 */
@Component({
  selector: 'app-transfer-roi-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './transfer-roi-page.component.html',
  styleUrl: './transfer-roi-page.component.scss'
})
export class TransferRoiPageComponent {
  private readonly roiService = inject(TransferRoiService);

  /** State of the club and season lists */
  readonly selectorsState = signal<LoadState>('loading');
  /** State of the selected club's ROI */
  readonly roiState = signal<LoadState>('loading');

  readonly clubs = signal<ClubOption[]>([]);
  readonly seasons = signal<SeasonOption[]>([]);
  readonly clubId = signal<string | null>(null);
  /** Null means every season */
  readonly seasonId = signal<string | null>(null);
  readonly roi = signal<ClubRoiResponse | null>(null);

  readonly sortKey = signal<SortKey>('date');
  readonly sortDirection = signal<SortDirection>('desc');

  readonly clubName = computed(() => this.clubs().find((c) => c.id === this.clubId())?.name ?? '');
  readonly rows = computed(() => sortTransfers(this.roi()?.transfers ?? [], this.sortKey(), this.sortDirection()));
  /** Signings whose gain is known, the ones netGain covers */
  readonly knownGainCount = computed(() => (this.roi()?.transfers ?? []).filter((t) => t.gain !== null).length);

  private readonly selection$ = new Subject<{ clubId: string; seasonId: string | null }>();

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.selection$
      .pipe(
        tap(() => this.roiState.set('loading')),
        // switchMap drops a slower answer for a club or season no longer selected
        switchMap(({ clubId, seasonId }) =>
          this.roiService.getClubRoi(clubId, seasonId).pipe(catchError(() => of(null)))
        ),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe((roi) => {
        this.roi.set(roi);
        this.roiState.set(roi ? 'ready' : 'error');
      });

    forkJoin({ clubs: this.roiService.getClubs(), seasons: this.roiService.getSeasons() })
      .pipe(
        map((lists): { clubs: ClubOption[]; seasons: SeasonOption[] } | null => lists),
        catchError(() => of(null)),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe((lists) => {
        if (!lists) {
          this.selectorsState.set('error');
          return;
        }
        this.clubs.set(lists.clubs);
        this.seasons.set(lists.seasons);
        this.selectorsState.set('ready');
        const initial = lists.clubs.find((c) => DEFAULT_CLUB.test(c.name)) ?? lists.clubs[0];
        if (initial) this.selectClub(initial.id);
      });
  }

  selectClub(clubId: string): void {
    this.clubId.set(clubId);
    this.reload();
  }

  selectSeason(seasonId: string): void {
    this.seasonId.set(seasonId || null);
    this.reload();
  }

  /** Sorts by a column; clicking the current column flips the direction */
  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      this.sortDirection.set(key === 'player' ? 'asc' : 'desc');
    }
  }

  /** aria-sort value of a column header */
  ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  reload(): void {
    const clubId = this.clubId();
    if (clubId) this.selection$.next({ clubId, seasonId: this.seasonId() });
  }
}
