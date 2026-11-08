import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { LineChartComponent, LineSeries } from '../../shared/line-chart/line-chart.component';
import { ClubOption, LeagueOption, SeasonOption } from '../transfer-roi/models/transfer-roi.model';
import { TransferRoiService } from '../transfer-roi/services/transfer-roi.service';
import { SquadValueHistory, SquadValueResponse } from './models/squad-value.model';
import { positionGroupLabel, positionLabel } from '../../shared/positions';
import { SquadValueService } from './services/squad-value.service';

type LoadState = 'loading' | 'ready' | 'error';

/** Club shown first when it is in the list */
const DEFAULT_CLUB = /lyon/i;
/** League shown first when it is in the list (Ligue 1) */
const DEFAULT_LEAGUE = 'FR1';

/**
 * Squad value dashboard (KF-3): league, club and season pickers (Ligue 1,
 * Lyon and the latest season by default), the squad's total value, the
 * totals per position, the evolution across seasons and the players sorted
 * by value.
 */
@Component({
  selector: 'app-squad-value-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, LineChartComponent],
  templateUrl: './squad-value-page.component.html',
  styleUrl: './squad-value-page.component.scss'
})
export class SquadValuePageComponent {
  // The league, club and season lists come from the same endpoints as the transfer ROI page
  private readonly pickerService = inject(TransferRoiService);
  private readonly squadService = inject(SquadValueService);

  readonly positionLabel = positionLabel;
  readonly positionGroupLabel = positionGroupLabel;

  /** State of the league, club and season lists */
  readonly selectorsState = signal<LoadState>('loading');
  /** State of the selected club's squad */
  readonly squadState = signal<LoadState>('loading');

  readonly leagues = signal<LeagueOption[]>([]);
  readonly leagueId = signal<string | null>(null);
  readonly clubs = signal<ClubOption[]>([]);
  readonly seasons = signal<SeasonOption[]>([]);
  readonly clubId = signal<string | null>(null);
  readonly seasonId = signal<string | null>(null);
  readonly squad = signal<SquadValueResponse | null>(null);
  /** Null when the history failed to load; the rest of the page still shows */
  readonly history = signal<SquadValueHistory | null>(null);

  readonly clubName = computed(() => this.clubs().find((c) => c.id === this.clubId())?.name ?? '');
  readonly chartLabels = computed(() => (this.history()?.seasons ?? []).map((s) => s.season.period));
  readonly chartSeries = computed((): LineSeries[] => [
    { label: "Valeur de l'effectif", data: (this.history()?.seasons ?? []).map((s) => s.totalValue) }
  ]);

  private readonly league$ = new Subject<string | null>();
  private readonly selection$ = new Subject<{ clubId: string; seasonId: string }>();

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.selection$
      .pipe(
        tap(() => this.squadState.set('loading')),
        // switchMap drops a slower answer for a club or season no longer selected
        switchMap(({ clubId, seasonId }) =>
          forkJoin({
            squad: this.squadService.getSquadValue(clubId, seasonId).pipe(catchError(() => of(null))),
            // The chart is optional: a failure only hides it
            history: this.squadService.getHistory(clubId).pipe(catchError(() => of(null)))
          })
        ),
        takeUntilDestroyed(destroyRef)
      )
      .subscribe(({ squad, history }) => {
        this.squad.set(squad);
        this.history.set(history);
        this.squadState.set(squad ? 'ready' : 'error');
      });

    this.league$
      .pipe(
        tap(() => this.selectorsState.set('loading')),
        switchMap((league) =>
          forkJoin({ clubs: this.pickerService.getClubs(league), seasons: this.pickerService.getSeasons(league) }).pipe(
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
        this.reload();
      });

    this.pickerService
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
    this.seasonId.set(seasonId);
    this.reload();
  }

  reload(): void {
    const clubId = this.clubId();
    const seasonId = this.seasonId();
    if (clubId && seasonId) this.selection$.next({ clubId, seasonId });
  }
}
