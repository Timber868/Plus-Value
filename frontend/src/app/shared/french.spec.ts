import { PremierPipe, firstOfMonth, DePipe, ofName } from './french';

describe('ofName', () => {
  it('elides "de" before a vowel or a mute h', () => {
    expect(ofName('Olympique Lyonnais')).toBe("d’Olympique Lyonnais");
    expect(ofName('Hertha BSC')).toBe("d’Hertha BSC");
  });

  it('keeps "de" before a consonant', () => {
    expect(ofName('AS Monaco')).toBe("d’AS Monaco");
    expect(ofName('Paris Saint-Germain')).toBe('de Paris Saint-Germain');
  });

  it('gives an empty string for a missing name in the pipe', () => {
    expect(new DePipe().transform(null)).toBe('');
  });
});

describe('firstOfMonth', () => {
  it('writes the first day of a month as "1er" and leaves other days alone', () => {
    expect(firstOfMonth('1 juin 2025')).toBe('1er juin 2025');
    expect(firstOfMonth('1 janv. 2018')).toBe('1er janv. 2018');
    expect(firstOfMonth('11 juin 2025')).toBe('11 juin 2025');
    expect(firstOfMonth('21 juin 2025')).toBe('21 juin 2025');
    expect(new PremierPipe().transform(null)).toBe('');
  });
});
