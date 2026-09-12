export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  baseValue: number;
  color: number;
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
