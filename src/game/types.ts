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
