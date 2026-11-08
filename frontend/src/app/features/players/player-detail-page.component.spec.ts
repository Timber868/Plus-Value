import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { appConfig } from '../../app.config';
import { PlayerDetailPageComponent } from './player-detail-page.component';

describe('PlayerDetailPageComponent', () => {
  let fixture: ComponentFixture<PlayerDetailPageComponent>;
  let httpMock: HttpTestingController;
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const profile = {
    id: 'p1',
    name: 'Alexandre Lacazette',
    birthDate: '1991-05-28T00:00:00.000Z',
    nationality: 'France',
    currentClub: { id: 'c1', name: 'Olympique Lyonnais' },
    latestMarketValue: { value: 5000000, date: '2025-12-18T00:00:00.000Z' },
    peakMarketValue: { value: 70000000, date: '2019-06-13T00:00:00.000Z' }
  };
  const marketValues = [
    { value: 70000000, date: '2019-06-13T00:00:00.000Z' },
    { value: 5000000, date: '2025-12-18T00:00:00.000Z' }
  ];

  beforeEach(() => {
    paramMap = new BehaviorSubject(convertToParamMap({ id: 'p1' }));
    TestBed.configureTestingModule({
      imports: [PlayerDetailPageComponent],
      providers: [
        ...appConfig.providers,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap } }
      ]
    });
    fixture = TestBed.createComponent(PlayerDetailPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  function respond(profileBody: object, values = marketValues, transfers: object[] = [], roi: object[] = []) {
    httpMock.expectOne('/api/players/p1').flush(profileBody);
    httpMock.expectOne('/api/players/p1/market-values').flush({ marketValues: values });
    httpMock.expectOne('/api/players/p1/transfers').flush({ transfers });
    httpMock.expectOne('/api/players/p1/transfers/roi').flush({ transfers: roi });
    fixture.detectChanges();
  }

  /** Collapses the narrow and regular spaces Angular puts in amounts and around blocks */
  function norm(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ');
  }

  const lyon = { id: 'c1', name: 'Olympique Lyonnais' };
  const arsenal = { id: 'c2', name: 'Arsenal FC' };

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows a loading message first', () => {
    expect(text()).toContain('Chargement du joueur en cours.');
    httpMock.match(() => true).forEach((req) => req.flush({}));
  });

  it('shows the profile, current and peak values, and the chart', () => {
    respond(profile);

    const page = text();
    expect(page).toContain('Alexandre Lacazette');
    expect(page).toContain('né le 28 mai 1991');
    expect(page).toContain('Club actuel : Olympique Lyonnais.');
    expect(page).toContain('5 000 000 €');
    expect(page).toContain('Estimation du 18 décembre 2025.');
    expect(page).toContain('70 000 000 €');
    expect(page).toContain('Atteinte le 13 juin 2019.');
    expect(fixture.nativeElement.querySelector('app-line-chart')).not.toBeNull();
    expect(fixture.componentInstance.chartLabels()).toEqual(['juin 2019', 'déc. 2025']);
    expect(fixture.componentInstance.chartSeries()[0].data).toEqual([70000000, 5000000]);
    // No transfers, so no marker series and no marker hint
    expect(fixture.componentInstance.chartSeries().length).toBe(1);
    expect(page).not.toContain('Les triangles marquent les transferts du joueur.');
    expect(page).toContain("Aucun transfert n'est enregistré pour ce joueur.");
  });

  it('says when the transfers fall outside the valuation history', () => {
    respond(profile, marketValues, [
      { date: '2010-07-01T00:00:00.000Z', fromClub: null, toClub: { id: 'c1', name: 'Olympique Lyonnais' }, fee: null }
    ]);

    expect(fixture.componentInstance.chartSeries().length).toBe(1);
    expect(text()).toContain('Les transferts de ce joueur ont eu lieu en dehors de la période couverte par ses estimations.');
  });

  it('adds the transfers as markers on the chart', () => {
    respond(profile, marketValues, [
      {
        date: '2025-08-01T00:00:00.000Z',
        fromClub: { id: 'c2', name: 'Arsenal FC' },
        toClub: { id: 'c1', name: 'Olympique Lyonnais' },
        fee: 0
      }
    ]);

    const markers = fixture.componentInstance.chartSeries()[1];
    expect(markers.label).toBe('Transferts');
    expect(markers.data).toEqual([null, 5000000]);
    expect(text()).toContain('Les triangles marquent les transferts du joueur.');
  });

  it('still shows the chart when the transfers fail to load', () => {
    httpMock.expectOne('/api/players/p1').flush(profile);
    httpMock.expectOne('/api/players/p1/market-values').flush({ marketValues });
    httpMock.expectOne('/api/players/p1/transfers').flush(null, { status: 500, statusText: 'Server Error' });
    httpMock.expectOne('/api/players/p1/transfers/roi').flush({ transfers: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-line-chart')).not.toBeNull();
    expect(fixture.componentInstance.chartSeries().length).toBe(1);
    expect(text()).toContain("Les transferts du joueur n'ont pas pu être chargés");
  });

  it('explains a missing current value and missing history', () => {
    respond({ ...profile, currentClub: null, latestMarketValue: null }, []);

    const page = text();
    expect(page).toContain('Club actuel inconnu.');
    expect(page).toContain("Le joueur n'a pas été réévalué lors du dernier mercato.");
    expect(page).toContain("Aucune estimation de valeur marchande n'est disponible pour ce joueur.");
    expect(fixture.nativeElement.querySelector('app-line-chart')).toBeNull();
  });

  it('says when the player does not exist', () => {
    httpMock.expectOne('/api/players/p1').flush({ error: 'Player not found' }, { status: 404, statusText: 'Not Found' });
    // forkJoin cancels the history request once the profile request fails
    expect(httpMock.match('/api/players/p1/market-values').every((req) => req.cancelled)).toBeTrue();
    expect(httpMock.match('/api/players/p1/transfers').every((req) => req.cancelled)).toBeTrue();
    expect(httpMock.match('/api/players/p1/transfers/roi').every((req) => req.cancelled)).toBeTrue();
    fixture.detectChanges();

    expect(text()).toContain('Joueur introuvable');
  });

  it('shows an error message when the server fails', () => {
    httpMock.expectOne('/api/players/p1').flush(null, { status: 500, statusText: 'Server Error' });
    // forkJoin cancels the history request once the profile request fails
    expect(httpMock.match('/api/players/p1/market-values').every((req) => req.cancelled)).toBeTrue();
    expect(httpMock.match('/api/players/p1/transfers').every((req) => req.cancelled)).toBeTrue();
    expect(httpMock.match('/api/players/p1/transfers/roi').every((req) => req.cancelled)).toBeTrue();
    fixture.detectChanges();

    expect(text()).toContain("Les données du joueur n'ont pas pu être chargées.");
  });

  it('loads the new player when the id changes', () => {
    respond(profile);

    paramMap.next(convertToParamMap({ id: 'p2' }));
    httpMock.expectOne('/api/players/p2').flush({ ...profile, id: 'p2', name: 'Rayan Cherki' });
    httpMock.expectOne('/api/players/p2/market-values').flush({ marketValues });
    httpMock.expectOne('/api/players/p2/transfers').flush({ transfers: [] });
    httpMock.expectOne('/api/players/p2/transfers/roi').flush({ transfers: [] });
    fixture.detectChanges();

    expect(text()).toContain('Rayan Cherki');
  });

  it("lists each transfer's result for the selling club", () => {
    respond(profile, marketValues, [], [
      {
        date: '2017-07-05T00:00:00.000Z',
        fromClub: lyon,
        toClub: arsenal,
        isLoan: false,
        fee: 53000000,
        sellerCost: 0,
        homegrown: true,
        loanFees: 0,
        marketValueAtSale: { value: 45000000, date: '2017-06-01T00:00:00.000Z' },
        gain: 53000000,
        roiPercent: null
      },
      {
        date: '2022-07-01T00:00:00.000Z',
        fromClub: arsenal,
        toClub: lyon,
        isLoan: false,
        fee: 0,
        sellerCost: 53000000,
        homegrown: false,
        loanFees: 500000,
        marketValueAtSale: null,
        gain: -52500000,
        roiPercent: -99.1
      }
    ]);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.roi tbody tr');
    expect(rows.length).toBe(2);
    const first = norm(rows[0].textContent);
    expect(first).toContain('De Olympique Lyonnais à Arsenal FC');
    expect(first).toContain('53 000 000 €');
    expect(first).toContain('Formé au club');
    expect(first).toContain('45 000 000 €');
    expect(rows[0].querySelector('.positive')).not.toBeNull();
    const second = norm(rows[1].textContent);
    expect(second).toContain('Inconnue');
    expect(second).toContain('-52 500 000 €');
    expect(second).toContain('dont 500 000 € de prêts');
    expect(second).toContain('-99,1 %');
    expect(rows[1].querySelector('.negative')).not.toBeNull();
  });

  it('flags loans and arrivals without a selling club', () => {
    respond(profile, marketValues, [], [
      {
        date: '2010-07-01T00:00:00.000Z',
        fromClub: null,
        toClub: lyon,
        isLoan: true,
        fee: null,
        sellerCost: null,
        homegrown: false,
        loanFees: 0,
        marketValueAtSale: null,
        gain: null,
        roiPercent: null
      }
    ]);

    const row = (fixture.nativeElement as HTMLElement).querySelector('.roi tbody tr');
    expect(norm(row?.textContent)).toContain('Arrivée à Olympique Lyonnais');
    expect(row?.querySelector('.badge')?.textContent).toBe('Prêt');
    expect(norm(row?.textContent)).toContain('Inconnu');
  });

  it('keeps the page when the transfer ROI fails to load', () => {
    httpMock.expectOne('/api/players/p1').flush(profile);
    httpMock.expectOne('/api/players/p1/market-values').flush({ marketValues });
    httpMock.expectOne('/api/players/p1/transfers').flush({ transfers: [] });
    httpMock.expectOne('/api/players/p1/transfers/roi').flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(text()).toContain('Alexandre Lacazette');
    expect(text()).toContain("La rentabilité des transferts de ce joueur n'a pas pu être calculée.");
  });
});
