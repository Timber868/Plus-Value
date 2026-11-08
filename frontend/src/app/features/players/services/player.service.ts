import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { MarketValuePoint, PlayerProfile, PlayerSearchResult, PlayerTransfer, PlayerTransferRoi } from '../models/player.model';

/** HTTP calls for the players feature (KF-1) */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly http = inject(HttpClient);

  /** Searches players by name through GET /api/players */
  search(query: string, limit = 20): Observable<PlayerSearchResult[]> {
    const params = new HttpParams().set('q', query).set('limit', limit);
    return this.http
      .get<{ results: PlayerSearchResult[] }>('/api/players', { params })
      .pipe(map((res) => res.results));
  }

  /** Loads a player's profile through GET /api/players/:id */
  getProfile(id: string): Observable<PlayerProfile> {
    return this.http.get<PlayerProfile>(`/api/players/${encodeURIComponent(id)}`);
  }

  /** Loads a player's market value history, oldest first, through GET /api/players/:id/market-values */
  getMarketValues(id: string): Observable<MarketValuePoint[]> {
    return this.http
      .get<{ marketValues: MarketValuePoint[] }>(`/api/players/${encodeURIComponent(id)}/market-values`)
      .pipe(map((res) => res.marketValues));
  }

  /** Loads a player's transfers, oldest first, through GET /api/players/:id/transfers */
  getTransfers(id: string): Observable<PlayerTransfer[]> {
    return this.http
      .get<{ transfers: PlayerTransfer[] }>(`/api/players/${encodeURIComponent(id)}/transfers`)
      .pipe(map((res) => res.transfers));
  }

  /** Loads the ROI of each of a player's transfers, oldest first, through GET /api/players/:id/transfers/roi */
  getTransferRoi(id: string): Observable<PlayerTransferRoi[]> {
    return this.http
      .get<{ transfers: PlayerTransferRoi[] }>(`/api/players/${encodeURIComponent(id)}/transfers/roi`)
      .pipe(map((res) => res.transfers));
  }
}
