import { Pipe, PipeTransform } from '@angular/core';

/** French "de" before a name, elided before a vowel or a mute h ("d'Olympique Lyonnais") */
export function ofName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d’${name}` : `de ${name}`;
}

/** Template form of ofName: {{ club.name | de }} gives "de Monaco" or "d'Olympique Lyonnais" */
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
