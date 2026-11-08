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
        roiPercent: 30
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
        roiPercent: null
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

  it('sorts by a column and flips the direction on a second click', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const firstPlayer = () => (fixture.nativeElement as HTMLElement).querySelector('tbody tr td a')?.textContent;

    expect(firstPlayer()).toBe('Orel Mangala');
    fixture.componentInstance.sortBy('gain');
    fixture.detectChanges();
    expect(firstPlayer()).toBe('Malick Fofana');
    fixture.componentInstance.sortBy('date');
    fixture.componentInstance.sortBy('date');
    fixture.detectChanges();
    expect(firstPlayer()).toBe('Malick Fofana');
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
