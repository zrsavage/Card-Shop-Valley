export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  baseValue: number;
  color: number;
  season: Season;
  /** Evolution line this card belongs to — same speciesId across all its stages. */
  speciesId: string;
  /** 1-indexed evolution stage (1 = base form). */
  stage: number;
  /** Total number of stages in this card's evolution line, for "Stage 2/3" display. */
  stageCount: number;
  /** A rare alternate-look version of the same card, worth much more. */
  shiny: boolean;
}

export interface ShelfSlot {
  id: string;
  card: Card | null;
  price: number;
}

export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

export interface ShopUpgrades {
  extraShelvesTier1: boolean;
  extraShelvesTier2: boolean;
  marketingSign: boolean;
  appraisersLoupe: boolean;
  bagTier1: boolean;
  bagTier2: boolean;
}

export interface TownUpgrades {
  fountainRepaired: boolean;
  festivalsUnlocked: boolean;
}

export interface CombatUpgrades {
  weaponTier1: boolean;
  weaponTier2: boolean;
  weaponTier3: boolean;
  vitalityTier1: boolean;
  vitalityTier2: boolean;
  vitalityTier3: boolean;
}

/** What an NPC currently wants gifted — season + rarity, not a specific
 * card, so it's a real target without being frustratingly narrow. */
export interface CardRequest {
  season: Season;
  rarity: Rarity;
}

export interface NpcState {
  friendship: number;
  lastTalkedDay: number;
  request: CardRequest | null;
}
