import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { MoneyToggleComponent } from '../../shared/money-toggle/money-toggle.component';
import { ClubOption, ClubRoiResponse, ClubTransferRoi, LeagueOption, SeasonOption } from './models/transfer-roi.model';
import { TransferRoiService } from './services/transfer-roi.service';
import { byCurrentMarketValue } from './transfer-roi-sort';

type LoadState = 'loading' | 'ready' | 'error';

/** Club shown first when it is in the list */
const DEFAULT_CLUB = /lyon/i;
/** League shown first when it is in the list (Ligue 1) */
const DEFAULT_LEAGUE = 'FR1';

/**
 * Club transfer ROI dashboard (KF-2): league, club and season pickers (Ligue 1,
 * Lyon and the latest season by default), club totals,
 * a table of the club's purchases with their return and a table of its
 * sales. Both tables are ordered by current market value, highest first.
 * Loans out do not count as a departure; their fees are part of the exit value.
 */
@Component({
  selector: 'app-transfer-roi-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, DecimalPipe, MoneyToggleComponent],
  templateUrl: './transfer-roi-page.component.html',
  styleUrl: './transfer-roi-page.component.scss'
})
export class TransferRoiPageComponent {
  private readonly roiService = inject(TransferRoiService);

  /** State of the league, club and season lists */
  readonly selectorsState = signal<LoadState>('loading');
  /** State of the selected club's ROI */
  readonly roiState = signal<LoadState>('loading');

  readonly leagues = signal<LeagueOption[]>([]);
  /** Null when no league is synced: clubs and seasons are then not filtered */
  readonly leagueId = signal<string | null>(null);
  readonly clubs = signal<ClubOption[]>([]);
  readonly seasons = signal<SeasonOption[]>([]);
  readonly clubId = signal<string | null>(null);
  /** Null means every season */
  readonly seasonId = signal<string | null>(null);
  readonly roi = signal<ClubRoiResponse | null>(null);
  /** The detailed view adds the date, the value at signing and the amount recovered */
  readonly expanded = signal(false);

  readonly clubName = computed(() => this.clubs().find((c) => c.id === this.clubId())?.name ?? '');
  /** True shows the amounts in constant euros of the reference year (ECS-164) */
  readonly constantEuros = signal(false);

  // In constant euros, the fee, the amount recovered, the gains and the ROI come from `adjusted`
  readonly purchases = computed(() =>
    byCurrentMarketValue(this.roi()?.transfers ?? []).map((row) => (this.constantEuros() ? toConstant(row) : row))
  );
  readonly sales = computed(() =>
    byCurrentMarketValue(this.roi()?.sales ?? []).map((sale) =>
      this.constantEuros() ? { ...sale, gain: sale.adjustedGain } : sale
    )
  );
  readonly totalSpent = computed(() => {
    const totals = this.roi()?.totals;
    return (this.constantEuros() ? totals?.adjusted.totalSpent : totals?.totalSpent) ?? 0;
  });
  readonly netGain = computed(() => {
    const totals = this.roi()?.totals;
    return (this.constantEuros() ? totals?.adjusted.netGain : totals?.netGain) ?? 0;
  });
  /** Signings whose gain is known, the ones netGain covers */
  readonly knownGainCount = computed(() => (this.roi()?.transfers ?? []).filter((t) => t.gain !== null).length);

  private readonly selection$ = new Subject<{ clubId: string; seasonId: string | null }>();
  private readonly league$ = new Subject<string | null>();

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

    this.league$
      .pipe(
        tap(() => this.selectorsState.set('loading')),
        // switchMap drops the lists of a league no longer selected
        switchMap((league) =>
          forkJoin({ clubs: this.roiService.getClubs(league), seasons: this.roiService.getSeasons(league) }).pipe(
            map((lists): { clubs: ClubOption[]; seasons: SeasonOption[] } | null => lists),
            catchError(() => of(null))
          )
        ),
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
        // Seasons come newest first, so the latest season is selected by default
        this.seasonId.set(lists.seasons[0]?.id ?? null);
        const initial = lists.clubs.find((c) => DEFAULT_CLUB.test(c.name)) ?? lists.clubs[0];
        this.clubId.set(initial?.id ?? null);
        this.roi.set(null);
        this.reload();
      });

    this.roiService
      .getLeagues()
      .pipe(
        map((leagues): LeagueOption[] | null => leagues),
        catchError(() => of(null)),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe((leagues) => {
        if (!leagues) {
          this.selectorsState.set('error');
          return;
        }
        this.leagues.set(leagues);
        const initial = leagues.find((l) => l.id === DEFAULT_LEAGUE) ?? leagues[0];
        this.selectLeague(initial?.id ?? '');
      });
  }

  /** Loads the clubs and seasons of a league ('' for no league filter) */
  selectLeague(leagueId: string): void {
    this.leagueId.set(leagueId || null);
    this.league$.next(leagueId || null);
  }

  selectClub(clubId: string): void {
    this.clubId.set(clubId);
    this.reload();
  }

  selectSeason(seasonId: string): void {
    this.seasonId.set(seasonId || null);
    this.reload();
  }

  toggleExpanded(): void {
    this.expanded.update((e) => !e);
  }

  reload(): void {
    const clubId = this.clubId();
    if (clubId) this.selection$.next({ clubId, seasonId: this.seasonId() });
  }
}

/** A purchase row showing its constant-euro figures in place of the nominal ones */
function toConstant(row: ClubTransferRoi): ClubTransferRoi {
  const a = row.adjusted;
  return {
    ...row,
    feePaid: a.feePaid,
    exit: { ...row.exit, value: a.exitValue },
    gain: a.gain,
    roiPercent: a.roiPercent,
    valueGain: a.valueGain,
    resaleGain: a.resaleGain
  };
}
