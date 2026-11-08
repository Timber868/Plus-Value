import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { SquadValueHistory, SquadValueResponse } from '../models/squad-value.model';

/** HTTP calls for the squad value feature (KF-3) */
@Injectable({ providedIn: 'root' })
export class SquadValueService {
  private readonly http = inject(HttpClient);

  /** Loads a club's squad and its value for one season */
  getSquadValue(clubId: string, seasonId: string): Observable<SquadValueResponse> {
    return this.http.get<SquadValueResponse>(
      `/api/clubs/${encodeURIComponent(clubId)}/seasons/${encodeURIComponent(seasonId)}/squad-value`
    );
  }

  /** Loads a club's total squad value for each season it played, oldest first */
  getHistory(clubId: string): Observable<SquadValueHistory> {
    return this.http.get<SquadValueHistory>(`/api/clubs/${encodeURIComponent(clubId)}/squad-value/history`);
  }
}
