import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PlayerSearchResult } from '../models/player.model';

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
}
