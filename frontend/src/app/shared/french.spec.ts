import { PremierPipe, firstOfMonth, DePipe, ofName } from './french';

describe('ofName', () => {
  it('adds "l’" before club names that take it', () => {
    expect(ofName('Olympique Lyonnais')).toBe('de l’Olympique Lyonnais');
    expect(ofName('AS Monaco')).toBe('de l’AS Monaco');
    expect(ofName('Ajax Amsterdam')).toBe('de l’Ajax Amsterdam');
  });

  it('writes "du" for club names that take "le"', () => {
    expect(ofName('Paris Saint-Germain')).toBe('du Paris Saint-Germain');
    expect(ofName('FC Nantes')).toBe('du FC Nantes');
    expect(ofName('Stade Rennais FC')).toBe('du Stade Rennais FC');
    expect(ofName('Le Havre AC')).toBe('du Havre AC');
  });

  it('elides "de" before a vowel or a mute h for other names', () => {
    expect(ofName('Arsenal FC')).toBe('d’Arsenal FC');
    expect(ofName('Hertha BSC')).toBe('d’Hertha BSC');
  });

  it('keeps "de" before a consonant', () => {
    expect(ofName('Botafogo')).toBe('de Botafogo');
    expect(ofName('Manchester City')).toBe('de Manchester City');
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
