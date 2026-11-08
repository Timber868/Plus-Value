import { positionGroupLabel, positionLabel } from './positions';

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
});
