import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AppComponent } from './app.component';

/**
 * Unit tests for AppComponent. We fake HTTP so tests never call your real backend.
 */
describe('AppComponent', () => {
  /** Lets us inspect and answer fake HTTP requests made during the test */
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideHttpClient(),
        // Pairs with HttpTestingController: requests stay in-memory
        provideHttpClientTesting()
      ]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  /** Ensures every HTTP request the test expected was handled (no stray calls left) */
  afterEach(() => {
    httpMock.verify();
  });

  /**
   * AppComponent calls GET /api/health in its constructor.
   * This helper finds that request and responds with fake JSON so the component can finish loading.
   */
  function flushHealth() {
    const req = httpMock.expectOne('/api/health');
    req.flush({ status: 'ok', database: 'connected' });
  }

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    flushHealth();
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'Plus-Value' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    flushHealth();
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Plus-Value');
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushHealth();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, Plus-Value');
  });
});
