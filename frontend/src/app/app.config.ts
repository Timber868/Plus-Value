import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

/**
 * App-wide configuration: these "providers" register features for dependency injection.
 * Anything listed here is available to components and services without manual wiring.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Angular change detection tuning (default zone setup for this app)
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Enables the Router: navigation between pages using routes from app.routes.ts
    provideRouter(routes),
    // Registers HttpClient (used by core/services/api.service.ts and other HTTP calls)
    provideHttpClient()
  ]
};
