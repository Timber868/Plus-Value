import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ClubOption, ClubRoiResponse, LeagueOption, SeasonOption } from '../models/transfer-roi.model';

function leagueParams(league: string | null): HttpParams | undefined {
  return league ? new HttpParams().set('league', league) : undefined;
}

/** HTTP calls for the transfer ROI feature (KF-2) */
@Injectable({ providedIn: 'root' })
export class TransferRoiService {
  private readonly http = inject(HttpClient);

  /** Lists the leagues for the picker, Ligue 1 first, through GET /api/leagues */
  getLeagues(): Observable<LeagueOption[]> {
    return this.http.get<{ leagues: LeagueOption[] }>('/api/leagues').pipe(map((res) => res.leagues));
  }

  /** Lists the clubs for the picker, sorted by name, optionally of one league, through GET /api/clubs */
  getClubs(league: string | null = null): Observable<ClubOption[]> {
    return this.http
      .get<{ clubs: ClubOption[] }>('/api/clubs', { params: leagueParams(league) })
      .pipe(map((res) => res.clubs));
  }

  /** Lists the seasons for the picker, newest first, optionally of one league, through GET /api/seasons */
  getSeasons(league: string | null = null): Observable<SeasonOption[]> {
    return this.http
      .get<{ seasons: SeasonOption[] }>('/api/seasons', { params: leagueParams(league) })
      .pipe(map((res) => res.seasons));
  }

  /** Loads a club's signings with their ROI, optionally for one season */
  getClubRoi(clubId: string, seasonId: string | null): Observable<ClubRoiResponse> {
    const params = seasonId ? new HttpParams().set('season', seasonId) : undefined;
    return this.http.get<ClubRoiResponse>(`/api/clubs/${encodeURIComponent(clubId)}/transfers/roi`, { params });
  }
}
