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
  const seasons = [{ id: 's25', period: '2025-2026', startDate: '', endDate: '', league: 'FR1' }];
  const roi = {
    transfers: [
      {
        player: { id: 'p1', name: 'Malick Fofana' },
        date: '2024-01-10T00:00:00.000Z',
        fromClub: { id: 'gent', name: 'KAA Gent' },
        isLoan: false,
        feePaid: 10000000,
        marketValueAtSigning: { value: 9000000, date: '2023-12-01T00:00:00.000Z' },
        exit: { type: 'resale', value: 13000000, date: '2025-07-01T00:00:00.000Z', loanFees: 3000000 },
        gain: 3000000,
        roiPercent: 30,
        soldFor: 10000000,
        currentMarketValue: 25000000
      },
      {
        player: { id: 'p2', name: 'Orel Mangala' },
        date: '2024-01-20T00:00:00.000Z',
        fromClub: { id: 'nfo', name: 'Nottingham Forest' },
        isLoan: true,
        feePaid: null,
        marketValueAtSigning: null,
        exit: { type: 'resale', value: 0, date: '2024-06-30T00:00:00.000Z', loanFees: 0 },
        gain: null,
        roiPercent: null,
        soldFor: null,
        currentMarketValue: 30000000
      }
    ],
    sales: [
      {
        player: { id: 'p3', name: 'Rayan Cherki' },
        date: '2025-07-01T00:00:00.000Z',
        toClub: { id: 'mci', name: 'Manchester City' },
        soldFor: 36500000,
        currentMarketValue: 40000000
      },
      {
        player: { id: 'p4', name: 'Bradley Barcola' },
        date: '2023-08-31T00:00:00.000Z',
        toClub: { id: 'psg', name: 'Paris Saint-Germain' },
        soldFor: null,
        currentMarketValue: 70000000
      }
    ],
    totals: { totalSpent: 10000000, totalCurrentValue: 0, totalResaleIncome: 10000000, totalLoanIncome: 3000000, netGain: 3000000 }
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

  function loadSelectors() {
    httpMock.expectOne('/api/clubs').flush({ clubs });
    httpMock.expectOne('/api/seasons').flush({ seasons });
    fixture.detectChanges();
  }

  it('selects Olympique Lyonnais by default and shows the totals and the signings', () => {
    expect(text()).toContain('Chargement des clubs et des saisons en cours.');
    loadSelectors();
    expect(text()).toContain('Calcul de la rentabilité des transferts en cours.');

    roiRequest('ol').flush(roi);
    fixture.detectChanges();

    const page = text();
    expect(page).toContain('Dépenses');
    expect(page).toContain('Gain net');
    expect(page).toContain('Sur 1 recrue dont le gain est connu.');
    expect(page).toContain('Malick Fofana');
    expect(page).toContain('dont 3 000 000 € de prêts');
    expect(page).toContain('30 %');
    expect(page).toContain('Prêt');
    expect(page).toContain('Fin du prêt le 30 juin 2024');
    expect(page).toContain('Revente le 1 juil. 2025');
  });

  it('reloads for the selected season', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);

    fixture.componentInstance.selectSeason('s25');
    const req = roiRequest('ol');
    expect(req.request.params.get('season')).toBe('s25');
    req.flush(roi);
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
    expect(players(tables[0])).toEqual(['Orel Mangala', 'Malick Fofana']);
    expect(soldFor(tables[0], 7)).toEqual(['N/A', '10 000 000 €']);
    expect(players(tables[1])).toEqual(['Bradley Barcola', 'Rayan Cherki']);
    expect(soldFor(tables[1], 5)).toEqual(['N/A', '36 500 000 €']);
  });

  it('explains when the ROI cannot be loaded and retries', () => {
    loadSelectors();
    roiRequest('ol').flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain("Les transferts de Olympique Lyonnais n'ont pas pu être chargés.");

    fixture.componentInstance.reload();
    roiRequest('ol').flush(roi);
  });

  it('explains when the club list cannot be loaded', () => {
    // The failed club list cancels the pending seasons request
    httpMock.expectOne('/api/clubs').flush({}, { status: 500, statusText: 'Server Error' });
    httpMock.match('/api/seasons');
    fixture.detectChanges();
    expect(text()).toContain("La liste des clubs n'a pas pu être chargée.");
  });
});
