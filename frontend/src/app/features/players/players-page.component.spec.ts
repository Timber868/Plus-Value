import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { appConfig } from '../../app.config';
import { FEATURED_COUNT, PlayersPageComponent, SEARCH_DEBOUNCE_MS } from './players-page.component';

describe('PlayersPageComponent', () => {
  let fixture: ComponentFixture<PlayersPageComponent>;
  let httpMock: HttpTestingController;

  const lacazette = {
    id: 'p1',
    name: 'Alexandre Lacazette',
    nationality: 'France',
    position: 'Attack',
    subPosition: 'Centre-Forward',
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

  /** Answers the featured squad's club and season lists (empty by default, which hides the list) */
  function answerPickers(clubs: unknown[] = [], seasons: unknown[] = []) {
    httpMock.match((r) => r.url === '/api/clubs').forEach((r) => r.flush({ clubs }));
    httpMock.match((r) => r.url === '/api/seasons').forEach((r) => r.flush({ seasons }));
  }

  afterEach(() => {
    answerPickers();
    httpMock.verify();
  });

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

    httpMock.expectNone((r) => r.url === '/api/players');
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
    expect(page).toContain('Olympique Lyonnais (Attaquant, avant-centre)');
    expect(page).toContain('5 000 000 €');
    expect(page).toContain('au 1er juin 2024');
    const link = fixture.nativeElement.querySelector('a.result') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/players/p1');
  }));

  it('shows unknown club and value when they are missing', fakeAsync(() => {
    type('laca');
    tick(SEARCH_DEBOUNCE_MS);
    httpMock
      .expectOne((r) => r.url === '/api/players')
      .flush({ results: [{ ...lacazette, currentClub: null, latestMarketValue: null, position: null, subPosition: null }] });

    const page = text();
    expect(page).toContain('Club inconnu');
    expect(page).not.toContain('(');
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

    expect(text()).toContain("La recherche n’a pas pu aboutir.");

    type('lacaz');
    tick(SEARCH_DEBOUNCE_MS);
    httpMock.expectOne((r) => r.url === '/api/players').flush({ results: [lacazette] });

    expect(text()).toContain('Alexandre Lacazette');
  }));

  describe('before the reader types', () => {
    const lyon = { id: 'ol', name: 'Olympique Lyonnais', country: 'France', logoUrl: null };
    const seasons = [
      { id: 's25', period: '2025/26' },
      { id: 's24', period: '2024/25' }
    ];

    function squadPlayer(i: number, value: number | null) {
      return {
        id: `p${i}`,
        name: `Joueur ${i}`,
        position: 'Midfield',
        subPosition: null,
        marketValue: value === null ? null : { value, date: '2025-06-01T00:00:00.000Z' }
      };
    }

    it('lists the most valuable players of Lyon in the latest Ligue 1 season', () => {
      const clubsReq = httpMock.match((r) => r.url === '/api/clubs')[0];
      expect(clubsReq.request.params.get('league')).toBe('FR1');
      clubsReq.flush({ clubs: [{ id: 'mon', name: 'AS Monaco', country: 'France' }, lyon] });
      answerPickers([], seasons);

      const players = [squadPlayer(1, 40000000), squadPlayer(2, null)];
      for (let i = 3; i <= 14; i++) players.push(squadPlayer(i, 1000000));
      httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush({
        club: { id: 'ol', name: 'Olympique Lyonnais' },
        season: { id: 's25', period: '2025/26' },
        referenceDate: '2025-06-01T00:00:00.000Z',
        players
      });

      const page = text();
      expect(page).toContain('Les joueurs les mieux valorisés de l’effectif de l’Olympique Lyonnais en 2025/26');
      expect(page).toContain('Valeurs marchandes au 1er juin 2025.');
      const rows = fixture.nativeElement.querySelectorAll('.featured-list a.result') as NodeListOf<HTMLAnchorElement>;
      // Unvalued players are left out
      expect(rows.length).toBe(FEATURED_COUNT);
      expect(rows[0].textContent).toContain('Joueur 1');
      expect(rows[0].textContent).toContain('Milieu');
      expect(rows[0].getAttribute('href')).toBe('/players/p1');
      expect(page).not.toContain('Joueur 2');
    });

    it('hides the list while the reader searches', fakeAsync(() => {
      answerPickers([lyon], seasons);
      httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush({
        club: { id: 'ol', name: 'Olympique Lyonnais' },
        season: { id: 's25', period: '2025/26' },
        referenceDate: '2025-06-01T00:00:00.000Z',
        players: [squadPlayer(1, 40000000)]
      });
      expect(text()).toContain('Joueur 1');

      type('laca');
      tick(SEARCH_DEBOUNCE_MS);
      httpMock.expectOne((r) => r.url === '/api/players').flush({ results: [lacazette] });
      expect(text()).not.toContain('Joueur 1');
    }));

    it('shows no list when Lyon is missing or its squad fails to load', () => {
      answerPickers([lyon], seasons);
      httpMock
        .expectOne('/api/clubs/ol/seasons/s25/squad-value')
        .flush(null, { status: 500, statusText: 'Server Error' });

      expect(fixture.nativeElement.querySelector('.featured')).toBeNull();
      expect(text()).toContain('Saisissez au moins deux lettres pour lancer la recherche.');
    });
  });
});
