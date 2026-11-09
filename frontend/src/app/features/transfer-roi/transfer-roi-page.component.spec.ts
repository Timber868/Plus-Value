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
        loanInFee: 2000000,
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
        loanInFee: 0,
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
        loanInFee: 0,
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
        toClub: { id: 'mci', name: 'Manchester City', logoUrl: '/crests/281.png' },
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
    leagueRequest('/api/clubs', 'FR1').flush({ clubs });
    leagueRequest('/api/seasons', 'FR1').flush({ seasons });
    fixture.detectChanges();
  }

  it('selects Ligue 1, Olympique Lyonnais and the latest season by default and shows the totals and the signings', () => {
    expect(text()).toContain('Chargement des clubs et des saisons en cours.');
    loadSelectors();
    expect(text()).toContain('Calcul de la rentabilité des transferts en cours.');

    const req = roiRequest('ol');
    expect(req.request.params.get('season')).toBe('s25');
    req.flush(roi);
    fixture.detectChanges();

    const page = text();
    expect(page).toContain('Dépenses');
    expect(page).toContain('Gain net des recrues');
    // Fofana: bought 10M, sold for 13M with loan fees; Mangala (loan, no fee) is not counted
    expect(page).toMatch(/\+3\s?M€/);
    expect(page).toContain('Ventes et valeur actuelle des recrues comptées (1), moins leur coût.');
    expect(page).toContain('1 recrue sans montant ou sans valeur connue n’est pas comptée.');
    expect(page).toContain('Vendues ou encore au club');
    expect(page).toMatch(/13\s?M€ de ventes et 0\s?€ de valeur pour les recrues encore au club\./);
    expect(page).toContain('Formés au club');
    expect(page).toMatch(/1 joueur issu du centre de formation sur la période : 0\s?€ de ventes et 1\s?M€ de valeur pour ceux encore au club\./);
    expect(page).toContain('Malick Fofana');
    expect(page).toContain('30 %');
    expect(page).toContain('Prêt');
    expect(page).toContain('Formé au club');
    expect(page).toContain('Dont 2 000 000 € pour le prêt');
    expect(page).toContain("Gain de valeur depuis l’achat");
    expect(page).toContain('Gain à la revente');
    expect(page).not.toContain('Valeur à la signature');
    expect(page).not.toContain('Revente le 1er juil. 2025');
  });

  it('switches between the simple and the detailed view with a two-way toggle', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const [simple, detailed] = [...el.querySelectorAll<HTMLButtonElement>('.segmented button')];
    expect(simple.textContent?.trim()).toBe('Vue simple');
    expect(simple.getAttribute('aria-pressed')).toBe('true');

    detailed.click();
    fixture.detectChanges();

    expect(detailed.getAttribute('aria-pressed')).toBe('true');
    expect(simple.getAttribute('aria-pressed')).toBe('false');
    expect(text()).toContain('Valeur à la signature');
  });

  it('shows the other club with its crest and a gain bar split between the cost and the gain', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.club-cell img')?.getAttribute('src')).toBe('/crests/281.png');
    expect(el.querySelector('.club-cell .badge')?.textContent?.trim()).toBe('NF');
    const saleBars = [...el.querySelectorAll('table')[1].querySelectorAll('app-gain-bar')];
    expect(saleBars.length).toBe(1);
    expect(saleBars[0].querySelector('.bar')).not.toBeNull();
  });

  it('labels every cell and marks the gain and ROI as the key figures of the phone cards (ECS-178)', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();

    const [purchases, sales] = [...(fixture.nativeElement as HTMLElement).querySelectorAll('table')];
    expect(purchases.classList).toContain('card-table');
    const cells = [...purchases.querySelectorAll('tbody tr')[0].querySelectorAll('td')];
    expect(cells.every((cell) => !!cell.dataset['label'])).toBeTrue();
    expect(purchases.querySelector<HTMLElement>('tbody td.card-title')?.dataset['label']).toBe('Joueur');
    expect([...purchases.querySelectorAll('tbody tr')[0].querySelectorAll<HTMLElement>('td.card-key')].map((c) => c.dataset['label'])).toEqual([
      "Gain depuis l’achat",
      'Rentabilité'
    ]);
    expect([...sales.querySelectorAll('tbody tr')[0].querySelectorAll<HTMLElement>('td.card-key')].map((c) => c.dataset['label'])).toEqual([
      'Vendu pour',
      'Gain'
    ]);
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
    expect(page).toContain('Les prêts ont rapporté 3 000 000 €.');
    expect(page).toContain('Fin du prêt le 30 juin 2024');
    expect(page).toContain('Revente le 1er juil. 2025');
  });

  it('says the player left without a known sale when the club did not sell him (ECS-169)', () => {
    loadSelectors();
    const left = { ...roi.transfers[0], exit: { type: 'left', value: null, date: '2025-07-01T00:00:00.000Z', loanFees: 0 }, gain: null, roiPercent: null, soldFor: null, resaleGain: null };
    roiRequest('ol').flush({ ...roi, transfers: [left] });
    fixture.componentInstance.toggleExpanded();
    fixture.detectChanges();

    const page = text();
    expect(page).toContain('Départ sans vente connue le 1er juil. 2025');
    expect(page).not.toContain('Toujours au club');
  });

  it('sorts a table by the clicked column, high to low first, and flips on a second click', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const header = (table: number, label: string) =>
      Array.from(el.querySelectorAll('table')[table].querySelectorAll('th button')).find(
        (b) => b.textContent?.trim() === label
      ) as HTMLButtonElement;
    const players = (table: number) =>
      Array.from(el.querySelectorAll('table')[table].querySelectorAll('tbody tr td:first-child a')).map((a) => a.textContent);

    header(0, 'Montant payé').click();
    fixture.detectChanges();
    expect(players(0)).toEqual(['Malick Fofana', 'Joueur Réserve', 'Orel Mangala']);
    expect(header(0, 'Montant payé').parentElement?.getAttribute('aria-sort')).toBe('descending');

    header(0, 'Montant payé').click();
    fixture.detectChanges();
    expect(players(0)).toEqual(['Joueur Réserve', 'Malick Fofana', 'Orel Mangala']);

    header(1, 'Vendu pour').click();
    fixture.detectChanges();
    expect(players(1)).toEqual(['Rayan Cherki', 'Bradley Barcola']);
  });

  it('shows Ligue 1, Ligue 2 and Ligue 3 tabs and loads the clicked league', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const tabs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('app-league-tabs button')) as HTMLButtonElement[];

    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Ligue 1', 'Ligue 2', 'Ligue 3']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');

    tabs[2].click();
    leagueRequest('/api/clubs', 'FR3').flush({ clubs: [] });
    leagueRequest('/api/seasons', 'FR3').flush({ seasons: [] });
    fixture.detectChanges();

    expect(text()).toContain("Aucun club n’est encore disponible pour ce championnat.");
  });

  it('picks a club from the crest dropdown', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const heroClub = () => el.querySelector('.page-hero .hero-club-name')?.textContent?.trim();
    expect(heroClub()).toBe('Olympique Lyonnais');
    expect(el.querySelector('.page-hero app-club-crest')).not.toBeNull();

    (el.querySelector('app-club-picker .trigger') as HTMLButtonElement).click();
    fixture.detectChanges();
    const monaco = Array.from(el.querySelectorAll('app-club-picker li')).find((li) => li.textContent?.includes('AS Monaco')) as HTMLElement;
    monaco.click();
    fixture.detectChanges();
    expect(heroClub()).toBe('AS Monaco');

    roiRequest('asm').flush(roi);
  });

  it('switches the amounts to constant euros of the reference year', () => {
    loadSelectors();
    roiRequest('ol').flush(roi);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const norm = (t: string | null | undefined) => t?.replace(/\s+/g, ' ').trim();
    const malick = () => norm(Array.from(el.querySelectorAll('tbody tr')).find((r) => r.textContent?.includes('Malick'))?.textContent);

    expect(text()).toContain("sans tenir compte de l’inflation");
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

    expect(text()).toContain("Aucun club n’est encore disponible pour ce championnat.");
  });

  it('orders purchases and sales by current market value and shows a dash when there is no sale fee', () => {
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
    expect(soldFor(tables[0], 5)).toEqual(['—', '10 000 000 €', '—']);
    expect(soldFor(tables[0], 6)).toEqual(['—', '15 000 000 €', '1 000 000 €']);
    expect(soldFor(tables[0], 7)).toEqual(['—', '0 €', '—']);
    expect(players(tables[1])).toEqual(['Bradley Barcola', 'Rayan Cherki']);
    // Sales: Joueur, Club acheteur, Vendu pour, Gain
    expect(soldFor(tables[1], 3)).toEqual(['—', '36 500 000 €']);
    expect(soldFor(tables[1], 4)).toEqual(['—', '36 500 000 € Formé au club']);
    expect(tables[1].querySelector('tbody tr:nth-child(2) td:nth-child(4)')?.classList).toContain('positive');
  });

  it('explains when the ROI cannot be loaded and retries', () => {
    loadSelectors();
    roiRequest('ol').flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(text()).toContain("Les transferts de l’Olympique Lyonnais n’ont pas pu être chargés.");

    fixture.componentInstance.reload();
    roiRequest('ol').flush(roi);
  });

  it('explains when the club list cannot be loaded', () => {
    // The failed club list cancels the pending seasons request
    leagueRequest('/api/clubs', 'FR1').flush({}, { status: 500, statusText: 'Server Error' });
    httpMock.match((req) => req.url === '/api/seasons');
    fixture.detectChanges();
    expect(text()).toContain("La liste des clubs n’a pas pu être chargée.");
  });
});
