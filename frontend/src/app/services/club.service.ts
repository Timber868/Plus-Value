// services/club.service.ts — Angular service for club API calls
// TODO: implement HTTP methods using HttpClient

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Club } from '../models/club.model';

@Injectable({ providedIn: 'root' })
export class ClubService {
  private readonly apiUrl = `${environment.apiUrl}/clubs`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: Club[] }> {
    // TODO: return this.http.get<...>(this.apiUrl);
    return new Observable(); // placeholder
  }

  getById(id: string): Observable<{ success: boolean; data: Club }> {
    // TODO: return this.http.get<...>(`${this.apiUrl}/${id}`);
    return new Observable(); // placeholder
  }

  create(club: Partial<Club>): Observable<{ success: boolean; data: Club }> {
    // TODO: return this.http.post<...>(this.apiUrl, club);
    return new Observable(); // placeholder
  }

  update(id: string, club: Partial<Club>): Observable<{ success: boolean; data: Club }> {
    // TODO: return this.http.put<...>(`${this.apiUrl}/${id}`, club);
    return new Observable(); // placeholder
  }

  delete(id: string): Observable<{ success: boolean }> {
    // TODO: return this.http.delete<...>(`${this.apiUrl}/${id}`);
    return new Observable(); // placeholder
  }
}
