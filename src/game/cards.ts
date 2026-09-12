import type { Card, Rarity } from './types';

export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0x8bd3ff,
  uncommon: 0x7ee787,
  rare: 0xffd166,
  epic: 0xc77dff,
  legendary: 0xff6b6b,
};

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const RARITY_BASE_VALUE: Record<Rarity, number> = {
  common: 5,
  uncommon: 12,
  rare: 30,
  epic: 75,
  legendary: 200,
};

const NAME_POOL: Record<Rarity, string[]> = {
  common: ['Puddle Slime', 'Field Mouse', 'Twiggy Sprout', 'Pebble Golem', 'Dust Bunny', 'Cabbage Cub'],
  uncommon: ['Ember Fox', 'Thistle Wolf', 'Storm Sparrow', 'Iron Beetle', 'Moss Turtle'],
  rare: ['Crimson Griffin', 'Void Serpent', 'Glacier Wyrm', 'Solar Panther'],
  epic: ['Starlight Phoenix', 'Abyssal Kraken', 'Thunder Djinn'],
  legendary: ['Celestial Dragon King', 'The Eternal Sphinx'],
};

let cardCounter = 0;

export function generateCard(rarity: Rarity): Card {
  const names = NAME_POOL[rarity];
  const name = names[Math.floor(Math.random() * names.length)];
  const valueJitter = 0.85 + Math.random() * 0.3;
  cardCounter += 1;
  return {
    id: `card-${Date.now()}-${cardCounter}`,
    name,
    rarity,
    baseValue: Math.round(RARITY_BASE_VALUE[rarity] * valueJitter),
    color: RARITY_COLORS[rarity],
  };
}
