import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { ClubCrestComponent } from '../../shared/club-crest/club-crest.component';
import { GainBarComponent } from '../../shared/gain-bar/gain-bar.component';
import { ClubPickerComponent } from '../../shared/club-picker/club-picker.component';
import { DePipe, PremierPipe } from '../../shared/french';
import { LeagueTabsComponent } from '../../shared/league-tabs/league-tabs.component';
import { leagueFromUrl, replaceQueryParams } from '../../shared/url-state';
import { LineChartComponent, LineSeries } from '../../shared/line-chart/line-chart.component';
import { CompactEuroPipe } from '../../shared/money/compact-euro';
import { ClubOption, SeasonOption } from '../transfer-roi/models/transfer-roi.model';
import { TransferRoiService } from '../transfer-roi/services/transfer-roi.service';
import { PositionTotal, SquadValueHistory, SquadValueResponse } from './models/squad-value.model';
import { positionAccent, positionGroupLabel, positionLabel } from '../../shared/positions';
import { SquadValueService } from './services/squad-value.service';

type LoadState = 'loading' | 'ready' | 'error';

/** Club shown first when it is in the list */
const DEFAULT_CLUB = /lyon/i;

/**
 * Squad value dashboard (KF-3): league, club and season pickers (Ligue 1,
 * Lyon and the latest season by default), the squad's total value, the
 * totals per position, the evolution across seasons and the players sorted
 * by value. The league, club and season live in the URL's query string, so
 * coming back from a player page restores them (ECS-181).
 */
@Component({
  selector: 'app-squad-value-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, PremierPipe, LineChartComponent, CompactEuroPipe, DePipe, ClubPickerComponent, LeagueTabsComponent, ClubCrestComponent, GainBarComponent],
  templateUrl: './squad-value-page.component.html',
  styleUrl: './squad-value-page.component.scss'
})
export class SquadValuePageComponent {
  // The league, club and season lists come from the same endpoints as the transfer ROI page
  private readonly pickerService = inject(TransferRoiService);
  private readonly squadService = inject(SquadValueService);
  private readonly router = inject(Router);

  readonly positionLabel = positionLabel;
  readonly positionGroupLabel = positionGroupLabel;
  readonly positionAccent = positionAccent;

  /** Share of the squad value per position, in percent, for the bar above the position cards */
  positionShares(groups: PositionTotal[]): { position: PositionTotal['position']; share: number }[] {
    const total = groups.reduce((sum, g) => sum + g.totalValue, 0);
    if (total <= 0) return [];
    return groups
      .filter((g) => g.totalValue > 0)
      .map((g) => ({ position: g.position, share: Math.round((g.totalValue / total) * 100) }));
  }

  /** State of the league, club and season lists */
  readonly selectorsState = signal<LoadState>('loading');
  /** State of the selected club's squad */
  readonly squadState = signal<LoadState>('loading');

  readonly leagueId = signal<string | null>(null);
  readonly clubs = signal<ClubOption[]>([]);
  readonly seasons = signal<SeasonOption[]>([]);
  readonly clubId = signal<string | null>(null);
  readonly seasonId = signal<string | null>(null);
  readonly squad = signal<SquadValueResponse | null>(null);
  /** Null when the history failed to load; the rest of the page still shows */
  readonly history = signal<SquadValueHistory | null>(null);

  /** The picked club, shown with its crest in the page hero */
  readonly selectedClub = computed(() => this.clubs().find((c) => c.id === this.clubId()) ?? null);
  readonly clubName = computed(() => this.selectedClub()?.name ?? '');
  readonly chartLabels = computed(() => (this.history()?.seasons ?? []).map((s) => s.season.period));
  readonly chartSeries = computed((): LineSeries[] => [
    {
      label: "Valeur de l’effectif",
      // A season without any valued player has no known value, not a value of 0 €
      data: (this.history()?.seasons ?? []).map((s) => (s.valuedPlayerCount > 0 ? s.totalValue : null))
    }
  ]);

  private readonly league$ = new Subject<string | null>();
  private readonly selection$ = new Subject<{ clubId: string; seasonId: string }>();

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Picks from the URL: the club and season apply when the first lists arrive
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    let wanted: { club: string | null; season: string | null } | null = {
      club: params.get('club'),
      season: params.get('season')
    };

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
        const season = lists.seasons.find((s) => s.id === wanted?.season) ?? lists.seasons[0];
        this.seasonId.set(season?.id ?? null);
        const initial =
          lists.clubs.find((c) => c.id === wanted?.club) ??
          lists.clubs.find((c) => DEFAULT_CLUB.test(c.name)) ??
          lists.clubs[0];
        this.clubId.set(initial?.id ?? null);
        wanted = null;
        this.reload();
      });

    this.selectLeague(leagueFromUrl(params.get('league')));

    // Keeps the URL in step with the picks once the lists are loaded
    effect(() => {
      if (this.selectorsState() !== 'ready') return;
      replaceQueryParams(this.router, { league: this.leagueId(), club: this.clubId(), season: this.seasonId() });
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
