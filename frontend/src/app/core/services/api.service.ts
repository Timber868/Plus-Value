import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { HealthResponse } from '../models/health.model';

/**
 * App-wide HTTP API access. Put singleton services here (`core/services/`) —
 * things like auth, logging, or a single API client used across many features.
 *
 * Feature-specific calls can live in `features/<name>/services/` later if they
 * are only used inside one area of the app.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  /** HttpClient is Angular's built-in way to call REST APIs (GET, POST, etc.). */
  private readonly http = inject(HttpClient);

  /**
   * Calls the backend health endpoint.
   *
   * We use the path `/api/health` (relative URL, no hostname).
   * During `ng serve`, Angular's dev server proxies `/api` to http://localhost:3000
   * — see `proxy.conf.json` and `angular.json` → serve.options.proxyConfig.
   * That way the browser does not need CORS setup for local development.
   */
  getHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>('/api/health');
  }
}
