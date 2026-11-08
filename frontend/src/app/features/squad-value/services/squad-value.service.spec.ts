import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { SquadValueService } from './squad-value.service';

describe('SquadValueService', () => {
  let service: SquadValueService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SquadValueService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads the squad value of a club and season and the history of a club', () => {
    let squad: unknown;
    let history: unknown;
    service.getSquadValue('ol', 's25').subscribe((s) => (squad = s));
    service.getHistory('ol').subscribe((h) => (history = h));

    httpMock.expectOne('/api/clubs/ol/seasons/s25/squad-value').flush({ players: [] });
    httpMock.expectOne('/api/clubs/ol/squad-value/history').flush({ seasons: [] });

    expect(squad).toEqual({ players: [] });
    expect(history).toEqual({ seasons: [] });
  });
});
