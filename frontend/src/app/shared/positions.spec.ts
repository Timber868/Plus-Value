import { positionAccent, positionDescription, positionGroupLabel, positionLabel } from './positions';

describe('position labels', () => {
  it('translates the dataset positions to French', () => {
    expect(positionLabel('Goalkeeper')).toBe('Gardien');
    expect(positionLabel('Attack')).toBe('Attaquant');
    expect(positionGroupLabel('Defender')).toBe('Défenseurs');
    expect(positionGroupLabel('Midfield')).toBe('Milieux');
  });

  it('names an unknown position', () => {
    expect(positionLabel(null)).toBe('Poste inconnu');
    expect(positionGroupLabel(null)).toBe('Poste inconnu');
  });

  it('describes a position with its sub-position', () => {
    expect(positionDescription('Attack', 'Centre-Forward')).toBe('Attaquant, avant-centre');
    expect(positionDescription('Defender', 'Left-Back')).toBe('Défenseur, arrière gauche');
    expect(positionDescription('Goalkeeper', 'Goalkeeper')).toBe('Gardien');
    expect(positionDescription('Midfield', 'Unknown Role')).toBe('Milieu');
    expect(positionDescription(null, 'Right Winger')).toBe('Ailier droit');
    expect(positionDescription(null, null)).toBeNull();
  });
});

describe('positionAccent', () => {
  it('gives each position group a fixed accent and unknown positions a neutral one', () => {
    expect(['Goalkeeper', 'Defender', 'Midfield', 'Attack'].map(positionAccent)).toEqual([
      'blue',
      'orange',
      'aqua',
      'yellow'
    ]);
    expect(positionAccent(null)).toBe('neutral');
  });
});
