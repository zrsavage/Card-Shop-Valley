export interface PrestigePerkDef {
  id: string;
  name: string;
  description: string;
}

// Chosen once per prestige — stacks if picked again on a later run, so a
// player who prestiges repeatedly keeps compounding whichever perk they
// lean into rather than being capped at one of each.
export const PRESTIGE_PERKS: PrestigePerkDef[] = [
  { id: 'goldenTouch', name: 'Golden Touch', description: '+10% gold from every shop sale.' },
  { id: 'ironGrip', name: 'Iron Grip', description: '+10% attack damage in the Wilds.' },
  { id: 'enduringSpirit', name: 'Enduring Spirit', description: '-15% energy drain.' },
  { id: 'packRat', name: 'Pack Rat', description: '+6 bag capacity.' },
];
