// A permanent perk tree — small percentage-based passive bonuses, bought
// with gold like every other upgrade, but organized as four short
// three-perk branches (each with its own theme) instead of one long linear
// stat grind. Unlike Combat/Movement upgrades (flat +damage/+HP/+speed),
// every perk here nudges a rate or a chance, so the payoff is in how it
// interacts with the rest of a run rather than a bigger number on its own.
// Perks never reset — not even on Prestige — same as the Encyclopedia and
// lifetime stats.

export type PerkBranch = 'combat' | 'commerce' | 'wilds' | 'fishing';

export const PERK_BRANCH_LABELS: Record<PerkBranch, string> = {
  combat: 'Combat',
  commerce: 'Commerce',
  wilds: 'Wilds Survival',
  fishing: 'Fishing & Friendship',
};

export interface PerkDef {
  id: string;
  branch: PerkBranch;
  name: string;
  description: string;
  cost: number;
  /** Must already own this perk before this one can be bought — each
   * branch is a simple 3-long chain, same shape as the weapon/vitality tiers. */
  requiresId?: string;
}

export const PERKS: PerkDef[] = [
  // Combat
  { id: 'bossBounty', branch: 'combat', name: 'Boss Bounty', description: '+15% bonus gold from defeating zone bosses.', cost: 300 },
  {
    id: 'secondWind',
    branch: 'combat',
    name: 'Second Wind',
    description: '+50% HP regen rate once out of combat.',
    cost: 300,
    requiresId: 'bossBounty',
  },
  {
    id: 'battleInstinct',
    branch: 'combat',
    name: 'Battle Instinct',
    description: '-15% attack cooldown in the Wilds.',
    cost: 700,
    requiresId: 'secondWind',
  },
  // Commerce
  { id: 'fairTrade', branch: 'commerce', name: 'Fair Trade', description: '+5% gold from every shop sale.', cost: 300 },
  {
    id: 'silverTongue',
    branch: 'commerce',
    name: 'Silver Tongue',
    description: 'Customers tolerate noticeably higher markups.',
    cost: 300,
    requiresId: 'fairTrade',
  },
  {
    id: 'bulkRelations',
    branch: 'commerce',
    name: 'Bulk Relations',
    description: '+10% combined chance of bulk-buyer and big-spender customers.',
    cost: 700,
    requiresId: 'silverTongue',
  },
  // Wilds
  { id: 'lightFeet', branch: 'wilds', name: 'Light Feet', description: '-10% energy drain while in the Wilds.', cost: 300 },
  {
    id: 'efficientTraveler',
    branch: 'wilds',
    name: 'Efficient Traveler',
    description: '-10% passive energy drain everywhere.',
    cost: 300,
    requiresId: 'lightFeet',
  },
  {
    id: 'treasureSense',
    branch: 'wilds',
    name: 'Treasure Sense',
    description: '+15% gold when selling packs unopened.',
    cost: 700,
    requiresId: 'efficientTraveler',
  },
  // Fishing & Friendship
  {
    id: 'patientAngler',
    branch: 'fishing',
    name: 'Patient Angler',
    description: '-20% energy cost per cast at the fountain.',
    cost: 300,
  },
  {
    id: 'luckyHook',
    branch: 'fishing',
    name: 'Lucky Hook',
    description: 'Better odds at rare-or-better fish.',
    cost: 300,
    requiresId: 'patientAngler',
  },
  {
    id: 'friendlyFace',
    branch: 'fishing',
    name: 'Friendly Face',
    description: '+1 extra friendship whenever you talk to townsfolk.',
    cost: 700,
    requiresId: 'luckyHook',
  },
];
