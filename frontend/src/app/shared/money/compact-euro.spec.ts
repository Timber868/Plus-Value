import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';

import { compactEuro } from './compact-euro';

describe('compactEuro', () => {
  beforeAll(() => registerLocaleData(localeFr, 'fr-FR'));

  it('writes millions with one decimal and a comma', () => {
    expect(compactEuro(131_800_000, 'fr-FR')).toBe('131,8 M€');
    expect(compactEuro(45_000_000, 'fr-FR')).toBe('45 M€');
  });

  it('writes thousands and small amounts', () => {
    expect(compactEuro(850_000, 'fr-FR')).toBe('850 k€');
    expect(compactEuro(900, 'fr-FR')).toBe('900 €');
    expect(compactEuro(0, 'fr-FR')).toBe('0 €');
  });

  it('keeps the sign of a loss', () => {
    expect(compactEuro(-12_500_000, 'fr-FR')).toBe('-12,5 M€');
  });
});
