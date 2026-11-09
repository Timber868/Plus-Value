import { CountryPipe, countryInFrench } from './countries';

describe('countryInFrench', () => {
  it('translates standard English country names into French', () => {
    expect(countryInFrench('Belgium')).toBe('Belgique');
    expect(countryInFrench('Germany')).toBe('Allemagne');
    expect(countryInFrench('Brazil')).toBe('Brésil');
    expect(countryInFrench('France')).toBe('France');
    expect(countryInFrench('Netherlands')).toBe('Pays-Bas');
  });

  it('handles Transfermarkt spellings and the home nations', () => {
    expect(countryInFrench("Cote d'Ivoire")).toBe('Côte d’Ivoire');
    expect(countryInFrench('Korea, South')).toBe('Corée du Sud');
    expect(countryInFrench('DR Congo')).toBe('Congo-Kinshasa');
    expect(countryInFrench('England')).toBe('Angleterre');
    expect(countryInFrench('Scotland')).toBe('Écosse');
  });

  it('keeps an unknown name and gives an empty string for none', () => {
    expect(countryInFrench('Atlantis')).toBe('Atlantis');
    expect(new CountryPipe().transform(null)).toBe('');
  });
});
