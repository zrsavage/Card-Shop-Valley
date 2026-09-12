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
}

export interface TownUpgrades {
  fountainRepaired: boolean;
  festivalsUnlocked: boolean;
}

export interface NpcState {
  friendship: number;
  lastTalkedDay: number;
}
