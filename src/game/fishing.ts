import type { Rarity } from './types';

// Fishing at the town fountain — a quiet, low-stakes side activity that
// trades energy for a modest, reliable bit of gold, distinct from both the
// Wilds (risk your HP for cards) and the shop counter (sell what you've
// already got). It has its own small "species" pool so there's a second,
// much shorter collection to complete alongside the card Encyclopedia.

export interface FishDef {
  id: string;
  name: string;
  rarity: Rarity;
  minValue: number;
  maxValue: number;
  flavor: string;
}

export const FISH_SPECIES: FishDef[] = [
  { id: 'fountain-minnow', name: 'Fountain Minnow', rarity: 'common', minValue: 4, maxValue: 7, flavor: "Darts between the coins tourists toss in." },
  { id: 'copper-guppy', name: 'Copper Guppy', rarity: 'common', minValue: 4, maxValue: 8, flavor: "Its scales have gone a little green, like an old coin." },
  { id: 'mossback-loach', name: 'Mossback Loach', rarity: 'common', minValue: 5, maxValue: 8, flavor: "Blends in with the fountain's algae a little too well." },
  { id: 'silverfin-trout', name: 'Silverfin Trout', rarity: 'uncommon', minValue: 10, maxValue: 16, flavor: "A surprisingly strong swimmer for a fountain fish." },
  { id: 'speckled-perch', name: 'Speckled Perch', rarity: 'uncommon', minValue: 11, maxValue: 17, flavor: "Freckled like it spends too much time in the sun." },
  { id: 'sunkoi', name: 'Sunkoi', rarity: 'rare', minValue: 25, maxValue: 38, flavor: "Bright orange, and it knows it." },
  { id: 'ironscale-bass', name: 'Ironscale Bass', rarity: 'rare', minValue: 28, maxValue: 42, flavor: "Scales tough enough to dull a fishhook." },
  { id: 'opal-pike', name: 'Opal Pike', rarity: 'epic', minValue: 60, maxValue: 90, flavor: "Shimmers like the inside of a seashell." },
  { id: 'wishing-carp', name: 'Wishing Carp', rarity: 'epic', minValue: 65, maxValue: 95, flavor: "Swallowed one too many of the town's lucky coins." },
  { id: 'fountain-king', name: 'The Fountain King', rarity: 'legendary', minValue: 180, maxValue: 260, flavor: "A koi as old as the fountain itself, scaled like beaten gold." },
];

// Skews common much harder than the card packs do — fishing is meant to be
// a steady trickle you can do between other things, not a competing way to
// find rare value.
const FISH_RARITY_WEIGHTS: Record<Rarity, number> = { common: 50, uncommon: 30, rare: 14, epic: 5, legendary: 1 };

export const FISHING_ENERGY_COST = 10;

export function rollFish(): FishDef {
  const entries = Object.entries(FISH_RARITY_WEIGHTS) as [Rarity, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  let rarity: Rarity = 'common';
  for (const [r, w] of entries) {
    if (roll < w) {
      rarity = r;
      break;
    }
    roll -= w;
  }
  const pool = FISH_SPECIES.filter((f) => f.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
