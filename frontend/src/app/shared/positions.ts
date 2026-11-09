/** Dataset position of a player; null when unknown */
export type Position = 'Goalkeeper' | 'Defender' | 'Midfield' | 'Attack' | null;

const SINGULAR: Record<string, string> = {
  Goalkeeper: 'Gardien',
  Defender: 'Défenseur',
  Midfield: 'Milieu',
  Attack: 'Attaquant'
};

const PLURAL: Record<string, string> = {
  Goalkeeper: 'Gardiens',
  Defender: 'Défenseurs',
  Midfield: 'Milieux',
  Attack: 'Attaquants'
};

/** Transfermarkt sub-positions in French */
const SUB_POSITIONS: Record<string, string> = {
  Goalkeeper: 'gardien de but',
  'Centre-Back': 'défenseur central',
  'Left-Back': 'arrière gauche',
  'Right-Back': 'arrière droit',
  'Defensive Midfield': 'milieu défensif',
  'Central Midfield': 'milieu central',
  'Attacking Midfield': 'milieu offensif',
  'Left Midfield': 'milieu gauche',
  'Right Midfield': 'milieu droit',
  'Left Winger': 'ailier gauche',
  'Right Winger': 'ailier droit',
  'Second Striker': 'second attaquant',
  'Centre-Forward': 'avant-centre'
};

/** French name of a position for one player, for example "Attaquant" */
export function positionLabel(position: Position | string | null | undefined): string {
  return (position && SINGULAR[position]) ?? 'Poste inconnu';
}

/** French name of a position group, for example "Attaquants" */
export function positionGroupLabel(position: Position | string | null | undefined): string {
  return (position && PLURAL[position]) ?? 'Poste inconnu';
}

/**
 * Position and sub-position in French, for example "Attaquant, avant-centre",
 * or null when both are unknown. The sub-position is left out when it says
 * nothing more (a goalkeeper) or is not a known Transfermarkt value.
 */
export function positionDescription(
  position: Position | string | null | undefined,
  subPosition: string | null | undefined
): string | null {
  const main = position ? SINGULAR[position] : undefined;
  const sub = subPosition ? SUB_POSITIONS[subPosition] : undefined;
  if (!main) return sub ? sub.charAt(0).toUpperCase() + sub.slice(1) : null;
  return sub && position !== 'Goalkeeper' ? `${main}, ${sub}` : main;
}

const ACCENTS: Record<string, string> = {
  Goalkeeper: 'blue',
  Defender: 'orange',
  Midfield: 'aqua',
  Attack: 'yellow'
};

/** Accent colour name of a position group (see styles.scss), always in the same order */
export function positionAccent(position: Position | string | null | undefined): string {
  return (position && ACCENTS[position]) ?? 'neutral';
}
