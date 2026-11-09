import { DePipe, ofName } from './french';

describe('ofName', () => {
  it('elides "de" before a vowel or a mute h', () => {
    expect(ofName('Olympique Lyonnais')).toBe("d'Olympique Lyonnais");
    expect(ofName('Hertha BSC')).toBe("d'Hertha BSC");
  });

  it('keeps "de" before a consonant', () => {
    expect(ofName('AS Monaco')).toBe("d'AS Monaco");
    expect(ofName('Paris Saint-Germain')).toBe('de Paris Saint-Germain');
  });

  it('gives an empty string for a missing name in the pipe', () => {
    expect(new DePipe().transform(null)).toBe('');
  });
});
