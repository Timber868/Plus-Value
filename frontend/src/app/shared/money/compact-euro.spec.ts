import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { compactEuro } from './compact-euro';

describe('compactEuro', () => {
  beforeAll(() => registerLocaleData(localeFr, 'fr-FR'));

  it('writes millions with one decimal and a comma', () => {
    expect(compactEuro(131_800_000, 'fr-FR')).toBe('131,8\u00a0M€');
    expect(compactEuro(45_000_000, 'fr-FR')).toBe('45\u00a0M€');
  });

  it('writes thousands and small amounts', () => {
    expect(compactEuro(850_000, 'fr-FR')).toBe('850\u00a0k€');
    expect(compactEuro(900, 'fr-FR')).toBe('900\u00a0€');
    expect(compactEuro(0, 'fr-FR')).toBe('0\u00a0€');
  });

  it('keeps the sign of a loss', () => {
    expect(compactEuro(-12_500_000, 'fr-FR')).toBe('-12,5\u00a0M€');
  });
});
