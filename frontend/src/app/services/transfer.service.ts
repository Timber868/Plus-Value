// services/transfer.service.ts — Angular service for transfer API calls
// TODO: implement HTTP methods using HttpClient

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Transfer } from '../models/transfer.model';

@Injectable({ providedIn: 'root' })
export class TransferService {
  private readonly apiUrl = `${environment.apiUrl}/transfers`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: Transfer[] }> {
    // TODO: return this.http.get<...>(this.apiUrl);
    return new Observable(); // placeholder
  }

  getById(id: string): Observable<{ success: boolean; data: Transfer }> {
    // TODO: return this.http.get<...>(`${this.apiUrl}/${id}`);
    return new Observable(); // placeholder
  }

  /** Fetch transfer ROI analysis for a club */
  getClubROI(clubId: string): Observable<{ success: boolean; data: unknown }> {
    // TODO: return this.http.get<...>(`${this.apiUrl}/roi/${clubId}`);
    return new Observable(); // placeholder
  }

  create(transfer: Partial<Transfer>): Observable<{ success: boolean; data: Transfer }> {
    // TODO: return this.http.post<...>(this.apiUrl, transfer);
    return new Observable(); // placeholder
  }

  update(id: string, transfer: Partial<Transfer>): Observable<{ success: boolean; data: Transfer }> {
    // TODO: return this.http.put<...>(`${this.apiUrl}/${id}`, transfer);
    return new Observable(); // placeholder
  }

  delete(id: string): Observable<{ success: boolean }> {
    // TODO: return this.http.delete<...>(`${this.apiUrl}/${id}`);
    return new Observable(); // placeholder
  }
}
