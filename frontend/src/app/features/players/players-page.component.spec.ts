import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { appConfig } from '../../app.config';
import { PlayersPageComponent, SEARCH_DEBOUNCE_MS } from './players-page.component';

describe('PlayersPageComponent', () => {
  let fixture: ComponentFixture<PlayersPageComponent>;
  let httpMock: HttpTestingController;

  const lacazette = {
    id: 'p1',
    name: 'Alexandre Lacazette',
    nationality: 'France',
    currentClub: { id: 'c1', name: 'Olympique Lyonnais' },
    latestMarketValue: { value: 5000000, date: '2024-06-01T00:00:00.000Z' }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlayersPageComponent],
      // appConfig brings the fr-FR locale; the testing providers replace real HTTP
      providers: [...appConfig.providers, provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    fixture = TestBed.createComponent(PlayersPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function type(value: string) {
    const input = fixture.nativeElement.querySelector('#player-search') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function text(): string {
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('asks for at least two letters before searching', fakeAsync(() => {
    type('l');
    tick(SEARCH_DEBOUNCE_MS);

    httpMock.expectNone(() => true);
    expect(text()).toContain('Saisissez au moins deux lettres pour lancer la recherche.');
  }));

  it('waits for the user to stop typing, then shows the results', fakeAsync(() => {
    type('la');
    tick(100);
    type('laca');
    tick(SEARCH_DEBOUNCE_MS);

    const req = httpMock.expectOne((r) => r.url === '/api/players');
    expect(req.request.params.get('q')).toBe('laca');
    expect(text()).toContain('Recherche en cours.');
    req.flush({ results: [lacazette] });

    const page = text();
    expect(page).toContain('Alexandre Lacazette');
    expect(page).toContain('Olympique Lyonnais');
    expect(page).toContain('5 000 000 €');
    const link = fixture.nativeElement.querySelector('a.result') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/players/p1');
  }));

  it('shows unknown club and value when they are missing', fakeAsync(() => {
    type('laca');
    tick(SEARCH_DEBOUNCE_MS);
    httpMock
      .expectOne((r) => r.url === '/api/players')
      .flush({ results: [{ ...lacazette, currentClub: null, latestMarketValue: null }] });

    const page = text();
    expect(page).toContain('Club inconnu');
    expect(page).toContain('Valeur inconnue');
  }));

  it('says when no player matches', fakeAsync(() => {
    type('zzz');
    tick(SEARCH_DEBOUNCE_MS);
    httpMock.expectOne((r) => r.url === '/api/players').flush({ results: [] });

    expect(text()).toContain('Aucun joueur ne correspond à cette recherche.');
  }));

  it('shows an error message when the search fails, and recovers on the next search', fakeAsync(() => {
    type('laca');
    tick(SEARCH_DEBOUNCE_MS);
    httpMock.expectOne((r) => r.url === '/api/players').flush(null, { status: 500, statusText: 'Server Error' });

    expect(text()).toContain("La recherche n'a pas pu aboutir.");

    type('lacaz');
    tick(SEARCH_DEBOUNCE_MS);
    httpMock.expectOne((r) => r.url === '/api/players').flush({ results: [lacazette] });

    expect(text()).toContain('Alexandre Lacazette');
  }));
});
