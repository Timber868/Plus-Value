import { TestBed } from '@angular/core/testing';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { LOCALE_ID } from '@angular/core';

import { appConfig } from './app.config';

/**
 * Checks that the app-wide providers format numbers, dates and amounts in French.
 */
describe('appConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, CurrencyPipe, DatePipe, DecimalPipe]
    });
  });

  it('uses the fr-FR locale', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('fr-FR');
  });

  // French uses a narrow no-break space (U+202F) as the thousands separator
  // and a no-break space (U+00A0) before the euro sign.
  it('formats numbers with French separators', () => {
    const pipe = TestBed.inject(DecimalPipe);
    expect(pipe.transform(1234567.5, '1.1-1')).toBe('1 234 567,5');
  });

  it('formats amounts in euros by default', () => {
    const pipe = TestBed.inject(CurrencyPipe);
    expect(pipe.transform(45000000, undefined, 'symbol', '1.0-0')).toBe('45 000 000 €');
  });

  it('formats dates in French', () => {
    const pipe = TestBed.inject(DatePipe);
    expect(pipe.transform(new Date(2026, 10, 7), 'longDate')).toBe('7 novembre 2026');
  });
});
