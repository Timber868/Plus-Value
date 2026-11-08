import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ClubOption, ClubRoiResponse, SeasonOption } from '../models/transfer-roi.model';

/** HTTP calls for the transfer ROI feature (KF-2) */
@Injectable({ providedIn: 'root' })
export class TransferRoiService {
  private readonly http = inject(HttpClient);

  /** Lists the clubs for the picker, sorted by name, through GET /api/clubs */
  getClubs(): Observable<ClubOption[]> {
    return this.http.get<{ clubs: ClubOption[] }>('/api/clubs').pipe(map((res) => res.clubs));
  }

  /** Lists the seasons for the picker, newest first, through GET /api/seasons */
  getSeasons(): Observable<SeasonOption[]> {
    return this.http.get<{ seasons: SeasonOption[] }>('/api/seasons').pipe(map((res) => res.seasons));
  }

  /** Loads a club's signings with their ROI, optionally for one season */
  getClubRoi(clubId: string, seasonId: string | null): Observable<ClubRoiResponse> {
    const params = seasonId ? new HttpParams().set('season', seasonId) : undefined;
    return this.http.get<ClubRoiResponse>(`/api/clubs/${encodeURIComponent(clubId)}/transfers/roi`, { params });
  }
}
