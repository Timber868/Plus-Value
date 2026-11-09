import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { AppComponent } from './app.component';
import { routes } from './app.routes';

/**
 * Unit tests for the app shell. HTTP is faked so tests never call the real backend.
 */
describe('AppComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function render() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the brand and one navigation link per dashboard', () => {
    const fixture = render();
    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.brand')?.textContent).toContain('Plus-Value');
    const links = Array.from(compiled.querySelectorAll('nav a')).map((a) => [
      a.getAttribute('href'),
      a.querySelector('.label-full')?.textContent?.trim()
    ]);
    expect(links).toEqual([
      ['/players', 'Joueurs'],
      ['/transfer-roi', 'Rentabilité des transferts'],
      ['/squad-value', "Valeur de l'effectif"]
    ]);
  });

  it('shows no server status when the server and database are available', () => {
    const fixture = render();
    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.api-health')?.textContent?.trim()).toBe('');
  });

  it('reports in French when the server cannot be reached', () => {
    const fixture = render();
    httpMock.expectOne('/api/health').flush(null, { status: 502, statusText: 'Bad Gateway' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.api-health-error')?.textContent).toContain(
      'Le serveur est injoignable pour le moment.'
    );
  });

  it('redirects the home page to the players dashboard and lazy-loads it', async () => {
    const fixture = render();
    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/');
    fixture.detectChanges();

    expect(router.url).toBe('/players');
    expect(fixture.nativeElement.querySelector('app-players-page h1')?.textContent).toBe('Joueurs');
  });

  it('opens the transfer ROI and squad value pages', async () => {
    const fixture = render();
    httpMock.expectOne('/api/health').flush({ status: 'ok', database: 'connected' });
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/transfer-roi');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-transfer-roi-page h1')?.textContent).toBe(
      'Rentabilité des transferts'
    );
    // The transfer ROI page loads its pickers; this test only checks the routing
    httpMock.match(() => true);

    await router.navigateByUrl('/squad-value');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-squad-value-page h1')?.textContent).toBe(
      "Valeur de l'effectif"
    );
    httpMock.match(() => true);
  });
});
