// services/player.service.ts — Angular service for player API calls
// TODO: implement HTTP methods using HttpClient

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Player } from '../models/player.model';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly apiUrl = `${environment.apiUrl}/players`;

  constructor(private http: HttpClient) {}

  /** Fetch all players, with optional query params (page, limit, position, etc.) */
  getAll(params?: Record<string, string>): Observable<{ success: boolean; data: Player[] }> {
    // TODO: return this.http.get<...>(this.apiUrl, { params });
    return new Observable(); // placeholder
  }

  /** Fetch a single player by ID */
  getById(id: string): Observable<{ success: boolean; data: Player }> {
    // TODO: return this.http.get<...>(`${this.apiUrl}/${id}`);
    return new Observable(); // placeholder
  }

  /** Create a new player */
  create(player: Partial<Player>): Observable<{ success: boolean; data: Player }> {
    // TODO: return this.http.post<...>(this.apiUrl, player);
    return new Observable(); // placeholder
  }

  /** Update an existing player */
  update(id: string, player: Partial<Player>): Observable<{ success: boolean; data: Player }> {
    // TODO: return this.http.put<...>(`${this.apiUrl}/${id}`, player);
    return new Observable(); // placeholder
  }

  /** Delete a player by ID */
  delete(id: string): Observable<{ success: boolean }> {
    // TODO: return this.http.delete<...>(`${this.apiUrl}/${id}`);
    return new Observable(); // placeholder
  }
}
