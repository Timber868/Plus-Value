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

/** Template form of ofName: {{ club.name | de }} gives "de l’AS Monaco" or "de Botafogo" */
@Pipe({ name: 'de' })
export class DePipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return name ? ofName(name) : '';
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
