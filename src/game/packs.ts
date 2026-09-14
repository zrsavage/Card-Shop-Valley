import type { Card, Rarity, Season } from './types';
import { generateCard } from './cards';

export interface PackDefinition {
  id: string;
  name: string;
  cost: number;
  cardCount: number;
  color: number;
  weights: Record<Rarity, number>;
  /**
   * Guaranteed gold for selling an unopened pack (only relevant for packs
   * earned free from combat) — a safe, consistent payout well below what
   * the cards inside average out to, since opening is the gamble: most
   * pulls lean common and can be worth less than this once you actually
   * have to move them off a shelf.
   */
  sellValue: number;
}

export const PACKS: PackDefinition[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    cost: 15,
    cardCount: 3,
    color: 0x8bd3ff,
    weights: { common: 65, uncommon: 25, rare: 8, epic: 2, legendary: 0 },
    sellValue: 20,
  },
  {
    id: 'deluxe',
    name: 'Deluxe Pack',
    cost: 45,
    cardCount: 4,
    color: 0xffd166,
    weights: { common: 40, uncommon: 32, rare: 20, epic: 7, legendary: 1 },
    sellValue: 60,
  },
  {
    id: 'mythic',
    name: 'Mythic Pack',
    cost: 120,
    cardCount: 5,
    color: 0xc77dff,
    weights: { common: 15, uncommon: 25, rare: 30, epic: 22, legendary: 8 },
    sellValue: 180,
  },
];

function pickWeighted(weights: Record<Rarity, number>): Rarity {
  const entries = Object.entries(weights) as [Rarity, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return entries[0][0];
}

export function openPack(pack: PackDefinition, season: Season): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < pack.cardCount; i++) {
    cards.push(generateCard(pickWeighted(pack.weights), season));
  }
  return cards;
}
