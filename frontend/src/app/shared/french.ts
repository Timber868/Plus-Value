import { Pipe, PipeTransform } from '@angular/core';

/** Club names that take "l’" in French: "de l’Olympique Lyonnais", "de l’AS Monaco" */
const ELIDED_ARTICLE = /^(Olympique|AS|OGC|AJ|AC|US|ESTAC|EA|Ajax|Inter|Atlético|Athletic)\b/;
/** Club names that take "le", so "de le" becomes "du": "du Paris Saint-Germain", "du FC Nantes" */
const MASCULINE_ARTICLE = /^(FC|RC|SC|SCO|LOSC|Stade|Racing|Paris|Red Star|Bayern|Real|Sporting|Borussia)\b/;

/**
 * French "de" before a club or person name. Clubs that take an article get it
 * ("de l’Olympique Lyonnais", "du Paris Saint-Germain", "du Havre AC");
 * other names elide "de" before a vowel or a mute h ("d’Arsenal FC").
 */
export function ofName(name: string): string {
  if (ELIDED_ARTICLE.test(name)) return `de l’${name}`;
  if (/^Le /.test(name)) return `du ${name.slice(3)}`;
  if (/^Les /.test(name)) return `des ${name.slice(4)}`;
  if (MASCULINE_ARTICLE.test(name)) return `du ${name}`;
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`;
}

/**
 * A club name with its article where it takes one, after a preposition such
 * as "pour" or "à": "l’Olympique Lyonnais", "le Paris Saint-Germain",
 * "Le Havre AC" (unchanged), "Botafogo".
 */
export function withArticle(name: string): string {
  if (ELIDED_ARTICLE.test(name)) return `l’${name}`;
  if (MASCULINE_ARTICLE.test(name)) return `le ${name}`;
  return name;
}

/** French "à" before a club name: "à l’Olympique Lyonnais", "au Paris Saint-Germain", "au Havre AC", "à Arsenal FC" */
export function toName(name: string): string {
  if (/^Le /.test(name)) return `au ${name.slice(3)}`;
  if (/^Les /.test(name)) return `aux ${name.slice(4)}`;
  const named = withArticle(name);
  return named.startsWith('le ') ? `au ${named.slice(3)}` : `à ${named}`;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Template form of ofName: {{ club.name | de }} gives "de l’AS Monaco" or
 * "de Botafogo"; {{ club.name | de: true }} starts a sentence ("D’Arsenal FC").
 */
@Pipe({ name: 'de' })
export class DePipe implements PipeTransform {
  transform(name: string | null | undefined, sentenceStart = false): string {
    if (!name) return '';
    return sentenceStart ? capitalize(ofName(name)) : ofName(name);
  }
}

/** Template form of toName: {{ club.name | a }} gives "à l’Olympique Lyonnais" or "au Paris Saint-Germain" */
@Pipe({ name: 'a' })
export class APipe implements PipeTransform {
  transform(name: string | null | undefined, sentenceStart = false): string {
    if (!name) return '';
    return sentenceStart ? capitalize(toName(name)) : toName(name);
  }
}

/** Template form of withArticle: "pour {{ club.name | article }}" gives "pour l’Olympique Lyonnais" */
@Pipe({ name: 'article' })
export class ArticlePipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return name ? withArticle(name) : '';
  }
}

/** French ordinal for the first day of a month: "1 juin 2025" becomes "1er juin 2025" */
export function firstOfMonth(date: string): string {
  return date.replace(/^1 /, '1er ');
}

/** Template form of firstOfMonth, after the date pipe: {{ d | date: 'd MMMM y' | premier }} */
@Pipe({ name: 'premier' })
export class PremierPipe implements PipeTransform {
  transform(date: string | null | undefined): string {
    return date ? firstOfMonth(date) : '';
  }
}
