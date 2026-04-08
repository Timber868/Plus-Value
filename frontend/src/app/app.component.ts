import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ApiService } from './core/services/api.service';

/**
 * Root component: the first component Angular loads. Its template is the main page layout.
 * The `selector: 'app-root'` matches <app-root> in index.html.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  /** Shown in the template as {{ title }} — Angular replaces that with this string. */
  title = 'Plus-Value';

  /**
   * Gets our API helper service from Angular's dependency injection.
   * Same ApiService instance is shared app-wide because the service uses `providedIn: 'root'`.
   */
  private readonly api = inject(ApiService);

  /**
   * Signals are reactive values: when you .set() them, the template updates automatically.
   * - healthLoading: true until the HTTP request finishes (success or failure).
   * - healthSummary: human-readable text when the backend responds OK (null until then).
   * - healthError: error message if the request fails (null when there is no error).
   */
  readonly healthLoading = signal(true);
  readonly healthSummary = signal<string | null>(null);
  readonly healthError = signal<string | null>(null);

  constructor() {
    /**
     * getHealth() returns an Observable — a stream that will emit the HTTP response later.
     * .subscribe() runs when the response arrives (next) or when something goes wrong (error).
     * This runs once when AppComponent is created (when the app starts).
     */
    this.api.getHealth().subscribe({
      // Backend returned 200 JSON: { status, database }
      next: (res) => {
        this.healthSummary.set(`API: ${res.status} · Database: ${res.database}`);
        this.healthLoading.set(false);
      },
      // Network error, wrong URL, or server down — HttpClient calls this instead of next
      error: () => {
        this.healthError.set(
          'Could not reach /api/health. Is the backend running on port 3000 with ng serve?'
        );
        this.healthLoading.set(false);
      }
    });
  }
}
