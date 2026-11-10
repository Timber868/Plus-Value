import { PremierPipe, firstOfMonth, DePipe, ofName, APipe, ArticlePipe, toName, withArticle } from './french';

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

describe('withArticle and toName', () => {
  it('gives the club its article after "pour"', () => {
    expect(withArticle('Olympique Lyonnais')).toBe('l’Olympique Lyonnais');
    expect(withArticle('Paris Saint-Germain')).toBe('le Paris Saint-Germain');
    expect(withArticle('Le Havre AC')).toBe('Le Havre AC');
    expect(withArticle('Botafogo')).toBe('Botafogo');
    expect(new ArticlePipe().transform(null)).toBe('');
  });

  it('contracts "à le" into "au"', () => {
    expect(toName('Olympique Lyonnais')).toBe('à l’Olympique Lyonnais');
    expect(toName('Paris Saint-Germain')).toBe('au Paris Saint-Germain');
    expect(toName('Le Havre AC')).toBe('au Havre AC');
    expect(toName('Arsenal FC')).toBe('à Arsenal FC');
  });

  it('can start a sentence', () => {
    expect(new APipe().transform('Olympique Lyonnais', true)).toBe('À l’Olympique Lyonnais');
    expect(new DePipe().transform('Arsenal FC', true)).toBe('D’Arsenal FC');
    expect(new APipe().transform(undefined)).toBe('');
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
