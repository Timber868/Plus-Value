import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { PlayerService } from './player.service';

describe('PlayerService', () => {
  let service: PlayerService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlayerService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('calls GET /api/players with the query and limit and unwraps the results', () => {
    let results: unknown;
    service.search('laca', 5).subscribe((r) => (results = r));

    const req = httpMock.expectOne((r) => r.url === '/api/players');
    expect(req.request.params.get('q')).toBe('laca');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ results: [{ id: 'p1', name: 'Alexandre Lacazette' }] });

    expect(results).toEqual([{ id: 'p1', name: 'Alexandre Lacazette' }]);
  });

  it('loads a profile and the market value history', () => {
    let profile: unknown;
    let values: unknown;
    service.getProfile('p1').subscribe((p) => (profile = p));
    service.getMarketValues('p1').subscribe((v) => (values = v));

    httpMock.expectOne('/api/players/p1').flush({ id: 'p1' });
    httpMock.expectOne('/api/players/p1/market-values').flush({ marketValues: [{ value: 1, date: '2024-01-01' }] });

    expect(profile).toEqual({ id: 'p1' });
    expect(values).toEqual([{ value: 1, date: '2024-01-01' }]);
  });
});
