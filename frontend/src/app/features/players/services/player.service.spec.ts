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
});
