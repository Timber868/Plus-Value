import { ApplicationConfig, DEFAULT_CURRENCY_CODE, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

// French formatting data for numbers, dates and currencies (used by the number, date and currency pipes)
registerLocaleData(localeFr, 'fr-FR');

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
    provideHttpClient(),
    // The UI is French: pipes format as fr-FR (1 234,5 and 7 nov. 2026) and amounts default to euros
    { provide: LOCALE_ID, useValue: 'fr-FR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'EUR' }
  ]
};
