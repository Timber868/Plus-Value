import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';

import { appConfig } from '../../app.config';
import { SquadValuePageComponent } from './squad-value-page.component';

describe('SquadValuePageComponent', () => {
  let fixture: ComponentFixture<SquadValuePageComponent>;
  let httpMock: HttpTestingController;

  const clubs = [
    { id: 'asm', name: 'AS Monaco', country: 'France' },
    { id: 'ol', name: 'Olympique Lyonnais', country: 'France' }
  ];
  const seasons = [
    { id: 's25', period: '2025/2026', startDate: '', endDate: '', league: 'FR1' },
    { id: 's24', period: '2024/2025', startDate: '', endDate: '', league: 'FR1' }
  ];
  const squad = {
    club: { id: 'ol', name: 'Olympique Lyonnais' },
    season: { id: 's25', period: '2025/2026' },
    referenceDate: '2025-12-18T00:00:00.000Z',
    players: [
      { id: 'p1', name: 'Malick Fofana', position: 'Attack', subPosition: 'Left Winger', marketValue: { value: 35000000, date: '2025-12-18T00:00:00.000Z' },
        joinedAt: '2024-01-10T00:00:00.000Z', joinedOnLoan: false, feePaid: 17000000, gainSinceJoining: 18000000, contractExpiresAt: '2028-06-30T00:00:00.000Z' },
      { id: 'p2', name: 'Lucas Perri', position: 'Goalkeeper', subPosition: 'Goalkeeper', marketValue: { value: 12000000, date: '2025-12-18T00:00:00.000Z' },
        joinedAt: '2024-07-20T00:00:00.000Z', joinedOnLoan: true, feePaid: 1000000, gainSinceJoining: null, contractExpiresAt: null },
      { id: 'p3', name: 'Inconnu', position: null, subPosition: null, marketValue: null }
    ],
    totals: {
      totalValue: 47000000,
      playerCount: 3,
      valuedPlayerCount: 2,
      byPosition: [
        { position: 'Goalkeeper', playerCount: 1, totalValue: 12000000 },
        { position: 'Attack', playerCount: 1, totalValue: 35000000 },
        { position: null, playerCount: 1, totalValue: 0 }
      ]
    }
  };
  const history = {
    club: { id: 'ol', name: 'Olympique Lyonnais' },
    seasons: [
      { season: { id: 's24', period: '2024/2025' }, referenceDate: '2025-05-17T00:00:00.000Z', totalValue: 300000000, playerCount: 25, valuedPlayerCount: 25 },
      { season: { id: 's25', period: '2025/2026' }, referenceDate: '2025-12-18T00:00:00.000Z', totalValue: 47000000, playerCount: 3, valuedPlayerCount: 2 }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SquadValuePageComponent],
      providers: [...appConfig.providers, provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    fixture = TestBed.createComponent(SquadValuePageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const leagueRequest = (url: string, league: string): TestRequest =>
    httpMock.expectOne((req) => req.url === url && req.params.get('league') === league);

  function loadSelectors() {
    leagueRequest('/api/clubs', 'FR1').flush({ clubs });
    leagueRequest('/api/seasons', 'FR1').flush({ seasons });
    fixture.detectChanges();
  }

  it('selects Lyon and the latest season and shows the total, the positions, the chart and the players', () => {
    expect(text()).toContain('Chargement des clubs et des saisons en cours.');
    loadSelectors();
    expect(text()).toContain("Calcul de la valeur de l’effectif en cours.");

    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.page-hero .hero-club-name')?.textContent?.trim()).toBe(
      'Olympique Lyonnais'
    );
    const page = text();
    expect(page).toContain('Valeur totale');
    expect(page).toContain('47 M€');
    expect(page).toContain('valeurs au 18 décembre 2025');
    expect(page).toContain("2 d’entre eux ont une valeur marchande connue.");
    expect(page).toContain('Gardiens');
    expect(page).toContain('Attaquants');
    expect(page).toContain('Poste inconnu');
    const segments = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.position-bar .segment'));
    expect(segments.map((el) => el.getAttribute('title'))).toEqual(['Gardiens : 26 %', 'Attaquants : 74 %']);
    expect(segments[0].classList).toContain('accent-blue');
    expect(page).toContain("Évolution de la valeur de l’effectif");
    expect((fixture.nativeElement as HTMLElement).querySelector('app-line-chart')).not.toBeNull();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')).map((r) =>
      r.textContent?.replace(/\s+/g, ' ').trim()
    );
    expect(rows[0]).toContain('Malick Fofana');
    expect(rows[0]).toContain('Attaquant');
    expect(rows[1]).toContain('Lucas Perri');
    expect(rows[1]).toContain('Gardien');
    expect(rows[2]).toContain('Inconnue');
  });

  it('lays the squad table out as labelled card rows on phone, with the value and the gain as key tiles', () => {
    loadSelectors();
    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const table = el.querySelector('table.card-table') as HTMLTableElement;
    expect(table).not.toBeNull();
    expect(table.closest('.card-wrap')).not.toBeNull();
    expect(el.querySelector('#' + table.getAttribute('aria-describedby'))?.textContent).toContain('classé par valeur marchande');
    const cells = Array.from(table.querySelectorAll('tbody tr:first-child td'));
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual([
      'Joueur',
      'Poste',
      'Valeur marchande',
      'Gain depuis l’arrivée',
      'Arrivée',
      'Fin de contrat',
    ]);
    expect(cells[0].classList).toContain('card-title');
    expect(cells.filter((c) => c.classList.contains('card-key')).length).toBe(2);
  });

  it('shows each player’s gain since he joined, his arrival and the end of his contract', () => {
    loadSelectors();
    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);
    fixture.detectChanges();
    const rows = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'));
    const text = rows.map((r) => (r.textContent ?? '').replace(/[\s\u202f\u00a0]+/g, ' ').trim());
    expect(text[0]).toContain('+18 000 000 €');
    expect(text[0]).toContain('10 janv. 2024');
    expect(text[0]).toContain('Payé 17 M€');
    expect(text[0]).toContain('juin 2028');
    expect(rows[0].querySelector('app-gain-bar .gain')).not.toBeNull();
    expect(text[1]).toContain('Prêté au club');
    expect(text[1]).toContain('Prêt');
  });

  it('leaves a gap in the chart for a season without any valued player instead of 0 €', () => {
    loadSelectors();
    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush({
      ...history,
      seasons: [
        { season: { id: 's19', period: '2019/2020' }, referenceDate: '2020-03-08T00:00:00.000Z', totalValue: 0, playerCount: 2, valuedPlayerCount: 0 },
        ...history.seasons
      ]
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.chartSeries()[0].data).toEqual([null, 300000000, 47000000]);
  });

  it('reloads for another season and keeps the page when the history fails', () => {
    loadSelectors();
    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);

    fixture.componentInstance.selectSeason('s24');
    httpMock.expectOne('/api/clubs/ol/seasons/s24/squad-value').flush({ ...squad, season: { id: 's24', period: '2024/2025' } });
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(text()).toContain('Effectif 2024/2025');
    expect(text()).toContain("L’évolution de la valeur de l’effectif n’a pas pu être chargée.");
  });

  it('explains when the squad cannot be loaded and retries', () => {
    loadSelectors();
    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush({}, { status: 500, statusText: 'Server Error' });
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);
    fixture.detectChanges();
    expect(text()).toContain("L’effectif de l’Olympique Lyonnais n’a pas pu être chargé.");

    fixture.componentInstance.reload();
    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);
  });

  it('explains when a league has no clubs or seasons', () => {
    leagueRequest('/api/clubs', 'FR1').flush({ clubs: [] });
    leagueRequest('/api/seasons', 'FR1').flush({ seasons: [] });
    fixture.detectChanges();

    expect(text()).toContain('Aucun club ni aucune saison ne sont encore disponibles pour ce championnat.');
  });

  it('keeps the league, club and season in the URL and starts from them when the page opens again (ECS-181)', async () => {
    const router = TestBed.inject(Router);
    loadSelectors();
    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);
    fixture.componentInstance.selectSeason('s24');
    httpMock.expectOne('/api/clubs/ol/seasons/s24/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush(history);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(query(router)).toBe('league=FR1&club=ol&season=s24');

    fixture.destroy();
    await router.navigateByUrl('/?league=FR2&club=asm&season=s24');
    const back = TestBed.createComponent(SquadValuePageComponent);
    back.detectChanges();
    leagueRequest('/api/clubs', 'FR2').flush({ clubs });
    leagueRequest('/api/seasons', 'FR2').flush({ seasons });
    httpMock.expectOne('/api/clubs/asm/seasons/s24/squad-value').flush(squad);
    httpMock.expectOne('/api/clubs/asm/squad-value/history').flush(history);
    back.detectChanges();
    expect(back.componentInstance.leagueId()).toBe('FR2');
  });

  /** The query string of the current URL; the path depends on the app's redirects */
  function query(router: Router): string {
    return router.url.split('?')[1] ?? '';
  }
});
