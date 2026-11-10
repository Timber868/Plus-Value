import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { ClubCrestComponent } from '../../shared/club-crest/club-crest.component';
import { ClubPickerComponent } from '../../shared/club-picker/club-picker.component';
import { ArticlePipe, DePipe, PremierPipe } from '../../shared/french';
import { LeagueTabsComponent } from '../../shared/league-tabs/league-tabs.component';
import { leagueFromUrl, replaceQueryParams } from '../../shared/url-state';
import { summarizeRoi } from './roi-summary';
import { GainBarComponent } from '../../shared/gain-bar/gain-bar.component';
import { MoneyToggleComponent } from '../../shared/money-toggle/money-toggle.component';
import { CompactEuroPipe } from '../../shared/money/compact-euro';
import { ClubOption, ClubRoiResponse, ClubTransferRoi, SeasonOption } from './models/transfer-roi.model';
import { TransferRoiService } from './services/transfer-roi.service';
import {
  PurchaseSortKey,
  SaleSortKey,
  TableSort,
  formatSort,
  nextSort,
  parsePurchaseSort,
  parseSaleSort,
  sortPurchases,
  sortSales
} from './transfer-roi-sort';

type LoadState = 'loading' | 'ready' | 'error';

/** Club shown first when it is in the list */
const DEFAULT_CLUB = /lyon/i;

/** Season value in the URL for every season */
const ALL_SEASONS = 'all';

/** Purchases start by current market value, highest first */
const DEFAULT_PURCHASE_SORT: TableSort<PurchaseSortKey> = { key: 'currentMarketValue', direction: 'desc' };

/**
 * Club transfer ROI dashboard (KF-2): league, club and season pickers (Ligue 1,
 * Lyon and the latest season by default), club totals,
 * a table of the club's purchases with their return and a table of its
 * sales. Both tables are ordered by current market value, highest first.
 * Loans out do not count as a departure; their fees are part of the exit value.
 * The picks (league, club, season, euros, view and sorts) live in the URL's
 * query string, so coming back from a player page restores them (ECS-181).
 */
@Component({
  selector: 'app-transfer-roi-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, PremierPipe, DecimalPipe, MoneyToggleComponent, CompactEuroPipe, DePipe, ArticlePipe, ClubPickerComponent, LeagueTabsComponent, ClubCrestComponent, GainBarComponent],
  templateUrl: './transfer-roi-page.component.html',
  styleUrl: './transfer-roi-page.component.scss'
})
export class TransferRoiPageComponent {
  private readonly roiService = inject(TransferRoiService);
  private readonly router = inject(Router);

  /** State of the league, club and season lists */
  readonly selectorsState = signal<LoadState>('loading');
  /** State of the selected club's ROI */
  readonly roiState = signal<LoadState>('loading');

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

  /** The picked club, shown with its crest in the page hero */
  readonly selectedClub = computed(() => this.clubs().find((c) => c.id === this.clubId()) ?? null);
  readonly clubName = computed(() => this.selectedClub()?.name ?? '');
  /** True shows the amounts in constant euros of the reference year (ECS-164) */
  readonly constantEuros = signal(false);

  /** Purchases start by current market value, highest first; a column header click changes it */
  readonly purchaseSort = signal<TableSort<PurchaseSortKey>>(DEFAULT_PURCHASE_SORT);
  /** Null keeps sales by the player's current market value, highest first */
  readonly saleSort = signal<TableSort<SaleSortKey> | null>(null);

  // In constant euros, the fee, the amount recovered, the gains and the ROI come from `adjusted`,
  // and sorting uses the figures shown
  readonly purchases = computed(() =>
    sortPurchases(
      (this.roi()?.transfers ?? []).map((row) => (this.constantEuros() ? toConstant(row) : row)),
      this.purchaseSort()
    )
  );
  readonly sales = computed(() =>
    sortSales(
      (this.roi()?.sales ?? []).map((sale) => (this.constantEuros() ? { ...sale, gain: sale.adjustedGain } : sale)),
      this.saleSort()
    )
  );

  /**
   * Headline figures: recruits (bought) and academy players kept apart, see
   * summarizeRoi. In constant euros the fees and values are the adjusted ones.
   */
  readonly summary = computed(() => summarizeRoi(this.purchases()));

  private readonly selection$ = new Subject<{ clubId: string; seasonId: string | null }>();
  private readonly league$ = new Subject<string | null>();

  constructor() {
    const destroyRef = inject(DestroyRef);

    // Picks from the URL: the club and season apply when the first lists arrive
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    let wanted: { club: string | null; season: string | null } | null = {
      club: params.get('club'),
      season: params.get('season')
    };
    this.constantEuros.set(params.get('euros') === 'constants');
    this.expanded.set(params.get('view') === 'detail');
    this.purchaseSort.set(parsePurchaseSort(params.get('sort')) ?? DEFAULT_PURCHASE_SORT);
    this.saleSort.set(parseSaleSort(params.get('salesSort')));

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
        const season =
          wanted?.season === ALL_SEASONS ? null : (lists.seasons.find((s) => s.id === wanted?.season) ?? lists.seasons[0]);
        this.seasonId.set(season?.id ?? null);
        const initial =
          lists.clubs.find((c) => c.id === wanted?.club) ??
          lists.clubs.find((c) => DEFAULT_CLUB.test(c.name)) ??
          lists.clubs[0];
        this.clubId.set(initial?.id ?? null);
        wanted = null;
        this.roi.set(null);
        this.reload();
      });

    this.selectLeague(leagueFromUrl(params.get('league')));

    // Keeps the URL in step with the picks once the lists are loaded
    effect(() => {
      if (this.selectorsState() !== 'ready') return;
      const purchaseSort = this.purchaseSort();
      const isDefaultSort =
        purchaseSort.key === DEFAULT_PURCHASE_SORT.key && purchaseSort.direction === DEFAULT_PURCHASE_SORT.direction;
      replaceQueryParams(this.router, {
        league: this.leagueId(),
        club: this.clubId(),
        season: this.seasonId() ?? ALL_SEASONS,
        euros: this.constantEuros() ? 'constants' : null,
        view: this.expanded() ? 'detail' : null,
        sort: isDefaultSort ? null : formatSort(purchaseSort),
        salesSort: formatSort(this.saleSort())
      });
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

  /** Sorts the purchases by a column; clicking it again flips the direction */
  sortPurchasesBy(key: PurchaseSortKey): void {
    this.purchaseSort.update((current) => nextSort(current, key));
  }

  /** Sorts the sales by a column; clicking it again flips the direction */
  sortSalesBy(key: SaleSortKey): void {
    this.saleSort.update((current) => nextSort(current, key));
  }

  /** aria-sort value of a column header, which also draws its arrow */
  ariaSort(sort: TableSort<string> | null, key: string): 'ascending' | 'descending' | 'none' {
    if (!sort || sort.key !== key) return 'none';
    return sort.direction === 'asc' ? 'ascending' : 'descending';
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

