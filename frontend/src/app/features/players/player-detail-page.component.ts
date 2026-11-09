import { CurrencyPipe, DatePipe, DecimalPipe, formatDate } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { DePipe, PremierPipe } from '../../shared/french';
import { LineChartComponent, LineSeries } from '../../shared/line-chart/line-chart.component';
import { CompactEuroPipe } from '../../shared/money/compact-euro';
import { MoneyToggleComponent } from '../../shared/money-toggle/money-toggle.component';
import { positionDescription } from '../../shared/positions';
import {
  MarketValuePoint,
  PlayerProfile,
  PlayerTransfer,
  PlayerTransferRoi,
  PlayerTransferRoiResponse
} from './models/player.model';
import { PlayerService } from './services/player.service';
import { buildTransferSeries } from './transfer-markers';

type PageState = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * Player page (KF-1): profile header with current and peak market value, and
 * the market value history as a line chart with transfers as markers, and
 * the ROI of each transfer (KF-2).
 */
@Component({
  selector: 'app-player-detail-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, PremierPipe, DecimalPipe, LineChartComponent, MoneyToggleComponent, CompactEuroPipe, DePipe],
  templateUrl: './player-detail-page.component.html',
  styleUrl: './player-detail-page.component.scss'
})
export class PlayerDetailPageComponent {
  private readonly playerService = inject(PlayerService);
  private readonly locale = inject(LOCALE_ID);

  readonly positionDescription = positionDescription;
  readonly state = signal<PageState>('loading');
  readonly profile = signal<PlayerProfile | null>(null);
  readonly marketValues = signal<MarketValuePoint[]>([]);
  readonly transfers = signal<PlayerTransfer[]>([]);
  /** False when the transfers request failed, so the page can say why no markers show */
  readonly transfersLoaded = signal(true);
  /** Null when the transfer ROI request failed; the rest of the page still shows */
  readonly transferRoi = signal<PlayerTransferRoi[] | null>([]);
  /** Year of the constant-euro figures; null until the ROI loads */
  readonly roiReferenceYear = signal<number | null>(null);
  /** True shows the ROI amounts in constant euros of the reference year (ECS-164) */
  readonly constantEuros = signal(false);
  /** ROI rows with their constant-euro figures in place of the nominal ones when asked */
  readonly roiRows = computed(() =>
    (this.transferRoi() ?? []).map((row) =>
      this.constantEuros()
        ? {
            ...row,
            fee: row.adjusted.fee,
            sellerCost: row.adjusted.sellerCost,
            gain: row.adjusted.gain,
            roiPercent: row.adjusted.roiPercent
          }
        : row
    )
  );

  /** X-axis labels such as "juin 2024" */
  readonly chartLabels = computed(() =>
    this.marketValues().map((point) => formatDate(point.date, 'MMM y', this.locale, 'UTC'))
  );
  readonly chartSeries = computed<LineSeries[]>(() => {
    const series: LineSeries[] = [
      { label: 'Valeur marchande', data: this.marketValues().map((point) => point.value) }
    ];
    const markers = buildTransferSeries(this.marketValues(), this.transfers(), this.locale);
    if (markers.data.some((value) => value !== null)) series.push(markers);
    return series;
  });

  constructor() {
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => params.get('id') ?? ''),
        tap(() => this.state.set('loading')),
        // switchMap cancels the previous player's requests when the id changes
        switchMap((id) =>
          forkJoin({
            profile: this.playerService.getProfile(id),
            marketValues: this.playerService.getMarketValues(id),
            // Transfers only add markers, so the page still shows when they fail to load
            transfers: this.playerService.getTransfers(id).pipe(
              map((transfers): PlayerTransfer[] | null => transfers),
              catchError(() => of(null))
            ),
            // The ROI section is optional too: a failure only replaces it with a message
            transferRoi: this.playerService.getTransferRoi(id).pipe(
              map((res): PlayerTransferRoiResponse | null => res),
              catchError(() => of(null))
            )
          }).pipe(
            catchError((error: unknown) => {
              const notFound = error instanceof HttpErrorResponse && (error.status === 404 || error.status === 400);
              return of(notFound ? ('not-found' as const) : ('error' as const));
            })
          )
        ),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe((outcome) => {
        if (outcome === 'not-found' || outcome === 'error') {
          this.profile.set(null);
          this.marketValues.set([]);
          this.transfers.set([]);
          this.transferRoi.set([]);
          this.roiReferenceYear.set(null);
          this.state.set(outcome);
          return;
        }
        this.profile.set(outcome.profile);
        this.marketValues.set(outcome.marketValues);
        this.transfers.set(outcome.transfers ?? []);
        this.transfersLoaded.set(outcome.transfers !== null);
        this.transferRoi.set(outcome.transferRoi?.transfers ?? null);
        this.roiReferenceYear.set(outcome.transferRoi?.inflation?.referenceYear ?? null);
        this.state.set('ready');
      });
  }
}
