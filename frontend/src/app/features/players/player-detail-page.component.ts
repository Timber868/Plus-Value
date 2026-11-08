import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, tap } from 'rxjs';

import { LineChartComponent, LineSeries } from '../../shared/line-chart/line-chart.component';
import { MarketValuePoint, PlayerProfile, PlayerTransfer } from './models/player.model';
import { PlayerService } from './services/player.service';
import { buildTransferSeries } from './transfer-markers';

type PageState = 'loading' | 'ready' | 'not-found' | 'error';

/**
 * Player page (KF-1): profile header with current and peak market value, and
 * the market value history as a line chart with transfers as markers.
 */
@Component({
  selector: 'app-player-detail-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, LineChartComponent],
  templateUrl: './player-detail-page.component.html',
  styleUrl: './player-detail-page.component.scss'
})
export class PlayerDetailPageComponent {
  private readonly playerService = inject(PlayerService);
  private readonly locale = inject(LOCALE_ID);

  readonly state = signal<PageState>('loading');
  readonly profile = signal<PlayerProfile | null>(null);
  readonly marketValues = signal<MarketValuePoint[]>([]);
  readonly transfers = signal<PlayerTransfer[]>([]);

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
            transfers: this.playerService.getTransfers(id).pipe(catchError(() => of([])))
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
          this.state.set(outcome);
          return;
        }
        this.profile.set(outcome.profile);
        this.marketValues.set(outcome.marketValues);
        this.transfers.set(outcome.transfers);
        this.state.set('ready');
      });
  }
}
