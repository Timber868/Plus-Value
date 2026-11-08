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

  function respond(profileBody: object, values = marketValues) {
    httpMock.expectOne('/api/players/p1').flush(profileBody);
    httpMock.expectOne('/api/players/p1/market-values').flush({ marketValues: values });
    fixture.detectChanges();
  }

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
    fixture.detectChanges();

    expect(text()).toContain('Joueur introuvable');
  });

  it('shows an error message when the server fails', () => {
    httpMock.expectOne('/api/players/p1').flush(null, { status: 500, statusText: 'Server Error' });
    // forkJoin cancels the history request once the profile request fails
    expect(httpMock.match('/api/players/p1/market-values').every((req) => req.cancelled)).toBeTrue();
    fixture.detectChanges();

    expect(text()).toContain("Les données du joueur n'ont pas pu être chargées.");
  });

  it('loads the new player when the id changes', () => {
    respond(profile);

    paramMap.next(convertToParamMap({ id: 'p2' }));
    httpMock.expectOne('/api/players/p2').flush({ ...profile, id: 'p2', name: 'Rayan Cherki' });
    httpMock.expectOne('/api/players/p2/market-values').flush({ marketValues });
    fixture.detectChanges();

    expect(text()).toContain('Rayan Cherki');
  });
});
