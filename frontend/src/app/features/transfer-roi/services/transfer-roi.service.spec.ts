import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { TransferRoiService } from './transfer-roi.service';

describe('TransferRoiService', () => {
  let service: TransferRoiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TransferRoiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists clubs and seasons', () => {
    let clubs: unknown;
    let seasons: unknown;
    service.getClubs().subscribe((c) => (clubs = c));
    service.getSeasons().subscribe((s) => (seasons = s));

    httpMock.expectOne('/api/clubs').flush({ clubs: [{ id: 'ol', name: 'Olympique Lyonnais', country: 'France' }] });
    httpMock.expectOne('/api/seasons').flush({ seasons: [{ id: 's1', period: '2024-2025' }] });

    expect(clubs).toEqual([{ id: 'ol', name: 'Olympique Lyonnais', country: 'France' }]);
    expect(seasons).toEqual([{ id: 's1', period: '2024-2025' }]);
  });

  it('loads a club ROI for every season or for one season', () => {
    service.getClubRoi('ol', null).subscribe();
    service.getClubRoi('ol', 's1').subscribe();

    const all = httpMock.expectOne((req) => req.url === '/api/clubs/ol/transfers/roi' && !req.params.has('season'));
    const one = httpMock.expectOne((req) => req.url === '/api/clubs/ol/transfers/roi' && req.params.get('season') === 's1');
    expect(all.request.method).toBe('GET');
    expect(one.request.method).toBe('GET');
    all.flush({ transfers: [], totals: {} });
    one.flush({ transfers: [], totals: {} });
  });
});
