import { Pipe, PipeTransform } from '@angular/core';

/**
 * Country names in the dataset are Transfermarkt's English names ("Belgium",
 * "Germany", "Cote d'Ivoire"). They are turned into French through the
 * browser's own country names (Intl.DisplayNames), so no long list has to be
 * maintained here: only the names that are not standard English country
 * names, or that are not countries, are listed below.
 */

/** Football nations that are not ISO countries, already in French */
const FRENCH_NAMES: Record<string, string> = {
  England: 'Angleterre',
  Scotland: 'Écosse',
  Wales: 'Pays de Galles',
  'Northern Ireland': 'Irlande du Nord',
  Tahiti: 'Tahiti'
};

/** Transfermarkt spellings mapped to their ISO 3166 code */
const ALIASES: Record<string, string> = {
  "Cote d'Ivoire": 'CI',
  'Ivory Coast': 'CI',
  'Korea, South': 'KR',
  'South Korea': 'KR',
  'Korea, North': 'KP',
  'DR Congo': 'CD',
  Congo: 'CG',
  'Bosnia-Herzegovina': 'BA',
  'Czech Republic': 'CZ',
  Turkey: 'TR',
  'Türkiye': 'TR',
  'The Gambia': 'GM',
  Gambia: 'GM',
  'Cape Verde': 'CV',
  Curacao: 'CW',
  'Chinese Taipei': 'TW',
  Hongkong: 'HK',
  'Hong Kong': 'HK',
  Macao: 'MO',
  'United States': 'US',
  USA: 'US',
  'Southern Sudan': 'SS',
  'South Sudan': 'SS',
  'St. Kitts & Nevis': 'KN',
  'St. Lucia': 'LC',
  'St. Vincent & Grenadinen': 'VC',
  'Antigua and Barbuda': 'AG',
  'Trinidad and Tobago': 'TT',
  'Neukaledonien': 'NC',
  'New Caledonia': 'NC',
  Palestine: 'PS',
  Kosovo: 'XK',
  Russia: 'RU',
  Iran: 'IR',
  Syria: 'SY',
  Vietnam: 'VN',
  Laos: 'LA',
  Moldova: 'MD',
  Bolivia: 'BO',
  Venezuela: 'VE',
  Tanzania: 'TZ',
  Eswatini: 'SZ',
  'North Macedonia': 'MK',
  'Central African Republic': 'CF',
  'Equatorial Guinea': 'GQ',
  'Guinea-Bissau': 'GW',
  Reunion: 'RE',
  'Réunion': 'RE',
  'Saint-Martin': 'MF',
  'Saint Martin': 'MF'
};

let englishToCode: Map<string, string> | null = null;

/** Every English country name the browser knows, keyed to its ISO code (built once) */
function codesByEnglishName(): Map<string, string> {
  if (englishToCode) return englishToCode;
  englishToCode = new Map();
  try {
    const english = new Intl.DisplayNames(['en'], { type: 'region' });
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (const a of letters) {
      for (const b of letters) {
        const code = a + b;
        const name = english.of(code);
        if (name && name !== code) englishToCode.set(name.toLowerCase(), code);
      }
    }
  } catch {
    // Without Intl.DisplayNames the English name is shown as is
  }
  return englishToCode;
}

/** French name of a country given in English, for example "Belgium" gives "Belgique"; unknown names stay as given */
export function countryInFrench(name: string | null | undefined): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (FRENCH_NAMES[trimmed]) return FRENCH_NAMES[trimmed];
  const code = ALIASES[trimmed] ?? codesByEnglishName().get(trimmed.toLowerCase());
  if (!code) return trimmed;
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) ?? trimmed;
  } catch {
    return trimmed;
  }
}

/** Template form of countryInFrench: {{ player.nationality | country }} */
@Pipe({ name: 'country' })
export class CountryPipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    return countryInFrench(name);
  }
}
