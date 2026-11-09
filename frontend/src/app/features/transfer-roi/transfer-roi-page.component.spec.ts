import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { appConfig } from '../../app.config';
import { TransferRoiPageComponent } from './transfer-roi-page.component';

describe('TransferRoiPageComponent', () => {
  let fixture: ComponentFixture<TransferRoiPageComponent>;
  let httpMock: HttpTestingController;

  const clubs = [
    { id: 'asm', name: 'AS Monaco', country: 'France' },
    { id: 'ol', name: 'Olympique Lyonnais', country: 'France' }
  ];
  const leagues = [
    { id: 'FR1', name: 'Ligue 1', country: 'France', tier: 1 },
    { id: 'FR2', name: 'Ligue 2', country: 'France', tier: 2 }
  ];
  const seasons = [
    { id: 's25', period: '2025-2026', startDate: '', endDate: '', league: 'FR1' },
    { id: 's24', period: '2024-2025', startDate: '', endDate: '', league: 'FR1' }
  ];
  const roi = {
    transfers: [
      {
        player: { id: 'p1', name: 'Malick Fofana' },
        date: '2024-01-10T00:00:00.000Z',
        fromClub: { id: 'gent', name: 'KAA Gent' },
        isLoan: false,
        reserveTeamMove: false,
        feePaid: 10000000,
        marketValueAtSigning: { value: 9000000, date: '2023-12-01T00:00:00.000Z' },
        exit: { type: 'resale', value: 13000000, date: '2025-07-01T00:00:00.000Z', loanFees: 3000000 },
        gain: 3000000,
        roiPercent: 30,
        soldFor: 10000000,
        currentMarketValue: 25000000,
        valueGain: 15000000,
        resaleGain: 0,
        adjusted: { feePaid: 11000000, exitValue: 13500000, gain: 2500000, roiPercent: 22.7, valueGain: 14000000, resaleGain: -500000 }
      },
      {
        player: { id: 'p2', name: 'Orel Mangala' },
        date: '2024-01-20T00:00:00.000Z',
        fromClub: { id: 'nfo', name: 'Nottingham Forest' },
        isLoan: true,
        reserveTeamMove: false,
        feePaid: null,
        marketValueAtSigning: null,
        exit: { type: 'resale', value: 0, date: '2024-06-30T00:00:00.000Z', loanFees: 0 },
        gain: null,
        roiPercent: null,
        soldFor: null,
        currentMarketValue: 30000000,
        valueGain: null,
        resaleGain: null,
        adjusted: { feePaid: null, exitValue: null, gain: null, roiPercent: null, valueGain: null, resaleGain: null }
      },
      {
        player: { id: 'p5', name: 'Joueur Réserve' },
        date: '2024-07-01T00:00:00.000Z',
        fromClub: { id: 'olb', name: 'Olympique Lyon B' },
        isLoan: false,
        reserveTeamMove: true,
        feePaid: 0,
        marketValueAtSigning: null,
        exit: { type: 'marketValue', value: 1000000, date: '2025-06-01T00:00:00.000Z', loanFees: 0 },
        gain: 1000000,
        roiPercent: null,
        soldFor: null,
        currentMarketValue: 1000000,
        valueGain: 1000000,
        resaleGain: null,
        adjusted: { feePaid: null, exitValue: null, gain: null, roiPercent: null, valueGain: null, resaleGain: null }
      }
    ],
    sales: [
      {
        player: { id: 'p3', name: 'Rayan Cherki' },
        date: '2025-07-01T00:00:00.000Z',
        toClub: { id: 'mci', name: 'Manchester City' },
        soldFor: 36500000,
        sellerCost: 0,
        homegrown: true,
        gain: 36500000,
        adjustedGain: 38000000,
        currentMarketValue: 40000000
      },
      {
        player: { id: 'p4', name: 'Bradley Barcola' },
        date: '2023-08-31T00:00:00.000Z',
        toClub: { id: 'psg', name: 'Paris Saint-Germain' },
        soldFor: null,
        sellerCost: 5000000,
        homegrown: false,
        gain: null,
        adjustedGain: null,
        currentMarketValue: 70000000
      }
    ],
    totals: { totalSpent: 10000000, totalCurrentValue: 0, totalResaleIncome: 10000000, totalLoanIncome: 3000000, netGain: 3000000, adjusted: { totalSpent: 11000000, netGain: 2500000 } },
    inflation: { index: 'hicp', referenceYear: 2025 }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TransferRoiPageComponent],
      providers: [...appConfig.providers, provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    });
    fixture = TestBed.createComponent(TransferRoiPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  const text = () => (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  const roiRequest = (clubId: string): TestRequest =>
    httpMock.expectOne((req) => req.url === `/api/clubs/${clubId}/transfers/roi`);

  const leagueRequest = (url: string, league: string): TestRequest =>
    httpMock.expectOne((req) => req.url === url && req.params.get('league') === league);

  function loadSelectors() {
    httpMock.expectOne('/api/leagues').flush({ leagues });
    leagueRequest('/api/clubs', 'FR1').flush({ clubs });
    leagueRequest('/api/seasons', 'FR1').flush({ seasons });
    fixture.detectChanges();
  }

  it('selects Ligue 1, Olympique Lyonnais and the latest season by default and shows the totals and the signings', () => {
    expect(text()).toContain('Chargement des championnats, des clubs et des saisons en cours.');
    loadSelectors();
    expect(text()).toContain('Calcul de la rentabilité des transferts en cours.');

    const req = roiRequest('ol');
    expect(req.request.params.get('season')).toBe('s25');
    req.flush(roi);
    fixture.detectChanges();

    const page = text();
    expect(page).toContain('Dépenses');
    expect(page).toContain('Gain net');
    expect(page).toContain('Sur 2 recrues dont le gain est connu.');
    expect(page).toContain('Malick Fofana');
    expect(page).toContain('30 %');
    expect(page).toContain('Prêt');
    expect(page).toContain('Équipe réserve');
    expect(page).toContain("Gain de valeur depuis l'achat");
    expect(page).toContain('Gain à la revente');
    expect(page).not.toContain('Valeur à la signature');
    expect(page).not.toContain('Revente le 1 juil. 2025');
  });

  it('shows the date, the value at signing and the amount recovered in the detailed view', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.componentInstance.toggleExpanded();
    fixture.detectChanges();

    const page = text();
    expect(page).toContain('Valeur à la signature');
    expect(page).toContain('Montant récupéré');
    expect(page).toContain('10 janv. 2024');
    expect(page).toContain('dont 3 000 000 € de prêts');
    expect(page).toContain('Fin du prêt le 30 juin 2024');
    expect(page).toContain('Revente le 1 juil. 2025');
  });

  it('switches the amounts to constant euros of the reference year', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const norm = (t: string | null | undefined) => t?.replace(/\s+/g, ' ').trim();
    const malick = () => norm(Array.from(el.querySelectorAll('tbody tr')).find((r) => r.textContent?.includes('Malick'))?.textContent);

    expect(text()).toContain("sans tenir compte de l'inflation");
    expect(malick()).toContain('30 %');

    (el.querySelectorAll('app-money-toggle button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text()).toContain('convertis en euros de 2025');
    expect(norm(text())).toContain('11 000 000 €');
    expect(malick()).toContain('22,7 %');
    expect(malick()).toContain('-500 000 €');
    expect(norm(text())).toContain('38 000 000 €');
  });

  it('reloads for the selected season, or for every season', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);

    fixture.componentInstance.selectSeason('s24');
    const one = roiRequest('ol');
    expect(one.request.params.get('season')).toBe('s24');
    one.flush(roi);

    fixture.componentInstance.selectSeason('');
    const all = roiRequest('ol');
    expect(all.request.params.has('season')).toBeFalse();
    all.flush(roi);
  });

  it('loads the clubs and seasons of the selected league and picks its first club and latest season', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);

    fixture.componentInstance.selectLeague('FR2');
    leagueRequest('/api/clubs', 'FR2').flush({ clubs: [{ id: 'asse', name: 'AS Saint-Étienne', country: 'France' }] });
    leagueRequest('/api/seasons', 'FR2').flush({ seasons: [{ id: 'l2s25', period: '2025-2026', startDate: '', endDate: '', league: 'FR2' }] });

    const req = roiRequest('asse');
    expect(req.request.params.get('season')).toBe('l2s25');
    req.flush(roi);
    fixture.detectChanges();
    expect(text()).toContain('Achats');
  });

  it('explains when a league has no clubs yet', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);

    fixture.componentInstance.selectLeague('FR2');
    leagueRequest('/api/clubs', 'FR2').flush({ clubs: [] });
    leagueRequest('/api/seasons', 'FR2').flush({ seasons: [] });
    fixture.detectChanges();

    expect(text()).toContain("Aucun club n'est encore disponible pour ce championnat.");
  });

  it('orders purchases and sales by current market value and shows N/A when there is no sale fee', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const tables = (fixture.nativeElement as HTMLElement).querySelectorAll('table');
    const players = (table: Element) => Array.from(table.querySelectorAll('tbody tr td:first-child a')).map((a) => a.textContent);
    const soldFor = (table: Element, column: number) =>
      Array.from(table.querySelectorAll(`tbody tr td:nth-child(${column})`)).map((td) => td.textContent?.replace(/\s+/g, ' ').trim());

    expect(text()).toContain('Achats');
    expect(text()).toContain('Ventes');
    expect(tables.length).toBe(2);
    expect(players(tables[0])).toEqual(['Orel Mangala', 'Malick Fofana', 'Joueur Réserve']);
    // Basic view: Joueur, Valeur actuelle, Club vendeur, Montant payé, Vendu pour, gains, ROI
    expect(soldFor(tables[0], 2)).toEqual(['30 000 000 €', '25 000 000 €', '1 000 000 €']);
    expect(soldFor(tables[0], 5)).toEqual(['N/A', '10 000 000 €', 'N/A']);
    expect(soldFor(tables[0], 6)).toEqual(['—', '15 000 000 €', '1 000 000 €']);
    expect(soldFor(tables[0], 7)).toEqual(['—', '0 €', '—']);
    expect(players(tables[1])).toEqual(['Bradley Barcola', 'Rayan Cherki']);
    // Sales: Joueur, Club acheteur, Vendu pour, Gain
    expect(soldFor(tables[1], 3)).toEqual(['N/A', '36 500 000 €']);
    expect(soldFor(tables[1], 4)).toEqual(['—', '36 500 000 € Formé au club']);
    expect(tables[1].querySelector('tbody tr:nth-child(2) td:nth-child(4)')?.classList).toContain('positive');
  });

  it('explains when the ROI cannot be loaded and retries', () => {
    loadSelectors();
    roiRequest('ol').flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain("Les transferts de Olympique Lyonnais n'ont pas pu être chargés.");

    fixture.componentInstance.reload();
    roiRequest('ol').flush(roi);
  });

  it('explains when the league list cannot be loaded', () => {
    httpMock.expectOne('/api/leagues').flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain("La liste des championnats et des clubs n'a pas pu être chargée.");
  });

  it('explains when the club list cannot be loaded', () => {
    httpMock.expectOne('/api/leagues').flush({ leagues });
    // The failed club list cancels the pending seasons request
    leagueRequest('/api/clubs', 'FR1').flush({}, { status: 500, statusText: 'Server Error' });
    httpMock.match((req) => req.url === '/api/seasons');
    fixture.detectChanges();
    expect(text()).toContain("La liste des championnats et des clubs n'a pas pu être chargée.");
  });
});
