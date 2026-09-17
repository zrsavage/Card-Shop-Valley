import type { Card, Rarity, Season } from './types';
import { generateCard, SHINY_VALUE_MULTIPLIER } from './cards';

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

// Rarity odds are intentionally stingy — since a card's evolution stage
// (and so its value multiplier, see STAGE_VALUE_MULTIPLIER) is fixed by its
// rarity, an epic or legendary pull is worth many times a common one, and
// packs need to feel like they're rationing that rather than handing it
// out. Starter and Deluxe are what regular Wilds kills mostly drop, so
// their shot at anything above uncommon stays extremely low; Mythic (the
// guaranteed boss/late-zone drop) is clearly the best of the three but its
// own legendary odds stay low too, so even a boss kill is a nice step up
// rather than a jackpot.
export const PACKS: PackDefinition[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    cost: 15,
    cardCount: 3,
    color: 0x8bd3ff,
    weights: { common: 800, uncommon: 165, rare: 30, epic: 4, legendary: 1 },
    sellValue: 20,
  },
  {
    id: 'deluxe',
    name: 'Deluxe Pack',
    cost: 45,
    cardCount: 4,
    color: 0xffd166,
    weights: { common: 650, uncommon: 260, rare: 75, epic: 13, legendary: 2 },
    sellValue: 60,
  },
  {
    id: 'mythic',
    name: 'Mythic Pack',
    cost: 120,
    cardCount: 5,
    color: 0xc77dff,
    weights: { common: 350, uncommon: 320, rare: 220, epic: 90, legendary: 20 },
    sellValue: 180,
  },
];

export function pickWeighted(weights: Record<Rarity, number>): Rarity {
  const entries = Object.entries(weights) as [Rarity, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return entries[0][0];
}

export function openPack(pack: PackDefinition, season: Season, opts?: { forceShinyOnce?: boolean }): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < pack.cardCount; i++) {
    cards.push(generateCard(pickWeighted(pack.weights), season));
  }
  if (opts?.forceShinyOnce && !cards.some((c) => c.shiny)) {
    const target = cards[Math.floor(Math.random() * cards.length)];
    target.shiny = true;
    target.baseValue = Math.round(target.baseValue * SHINY_VALUE_MULTIPLIER);
  }
  return cards;
}
