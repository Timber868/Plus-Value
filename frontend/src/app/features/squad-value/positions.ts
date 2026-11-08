import { Position } from './models/squad-value.model';

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

/** French name of a position for one player, for example "Attaquant" */
export function positionLabel(position: Position): string {
  return (position && SINGULAR[position]) ?? 'Poste inconnu';
}

/** French name of a position group, for example "Attaquants" */
export function positionGroupLabel(position: Position): string {
  return (position && PLURAL[position]) ?? 'Poste inconnu';
}
