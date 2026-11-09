import { Pipe, PipeTransform } from '@angular/core';

/** French "de" before a name, elided before a vowel or a mute h ("d'Olympique Lyonnais") */
export function ofName(name: string): string {
  return /^[aeiouyhàâäéèêëîïôöùûü]/i.test(name) ? `d'${name}` : `de ${name}`;
}

/** Template form of ofName: {{ club.name | de }} gives "de Monaco" or "d'Olympique Lyonnais" */
@Pipe({ name: 'de' })
export class DePipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return name ? ofName(name) : '';
  }
}
