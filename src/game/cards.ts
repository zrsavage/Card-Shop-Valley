import type { Card, Rarity, Season } from './types';

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

// The market runs hotter as the year gets harder to shop in — winter cards
// fetch the steepest prices, spring the least.
export const SEASON_PRICE_MULTIPLIER: Record<Season, number> = {
  Spring: 1.0,
  Summer: 1.15,
  Fall: 1.3,
  Winter: 1.5,
};

// One themed 20-card set per season (6 common / 5 uncommon / 4 rare / 3 epic / 2 legendary).
const SEASON_NAME_POOL: Record<Season, Record<Rarity, string[]>> = {
  Spring: {
    common: ['Puddle Slime', 'Field Mouse', 'Twiggy Sprout', 'Pebble Golem', 'Dust Bunny', 'Cabbage Cub'],
    uncommon: ['Ember Fox', 'Thistle Wolf', 'Storm Sparrow', 'Iron Beetle', 'Moss Turtle'],
    rare: ['Crimson Griffin', 'Void Serpent', 'Blossom Wyrm', 'Solar Panther'],
    epic: ['Starlight Phoenix', 'Abyssal Kraken', 'Thunder Djinn'],
    legendary: ['Celestial Dragon King', 'The Eternal Sphinx'],
  },
  Summer: {
    common: ['Sun Skink', 'Sand Crab', 'Tide Minnow', 'Coral Sprite', 'Palm Beetle', 'Driftwood Golem'],
    uncommon: ['Blaze Salamander', 'Riptide Ray', 'Dune Jackal', 'Sunflare Hawk', 'Reef Serpent'],
    rare: ['Molten Lionfish', 'Cyclone Roc', 'Amberscale Drake', 'Mirage Sphinx'],
    epic: ['Solstice Phoenix', 'Reef Leviathan', 'Desert Djinn King'],
    legendary: ['The Sunfire Empress', 'Kraken of the Deep Tide'],
  },
  Fall: {
    common: ['Acorn Squirrel', 'Pumpkin Sprite', 'Harvest Mouse', 'Rustling Owlet', 'Amber Beetle', 'Scarecrow Wisp'],
    uncommon: ['Maple Fox', 'Cider Boar', 'Withering Wraith', 'Chestnut Golem', 'Harvest Hawk'],
    rare: ['Blood Moon Stag', 'Rotwood Treant', 'Amberfall Wyrm', 'Harvestwind Griffin'],
    epic: ['Autumn Reaper', 'The Withered King', 'Stormcrow Djinn'],
    legendary: ['The Harvest Moon Dragon', "Old Man Frost's Herald"],
  },
  Winter: {
    common: ['Frost Vole', 'Snow Hare', 'Icicle Sprite', 'Pine Marten', 'Drift Beetle', 'Powder Golem'],
    uncommon: ['Glacier Fox', 'Blizzard Owl', 'Rime Wolf', 'Frostbite Hawk', 'Icebound Turtle'],
    rare: ['Glacier Wyrm', 'Permafrost Griffin', 'Auroraback Stag', 'Void-Ice Serpent'],
    epic: ['Yeti Warlord', 'Frozen Kraken', 'Boreal Djinn'],
    legendary: ['The Eternal Winter Dragon', 'Aurora Sphinx Queen'],
  },
};

let cardCounter = 0;

export function generateCard(rarity: Rarity, season: Season): Card {
  const names = SEASON_NAME_POOL[season][rarity];
  const name = names[Math.floor(Math.random() * names.length)];
  const valueJitter = 0.85 + Math.random() * 0.3;
  cardCounter += 1;
  return {
    id: `card-${Date.now()}-${cardCounter}`,
    name,
    rarity,
    season,
    baseValue: Math.round(RARITY_BASE_VALUE[rarity] * valueJitter * SEASON_PRICE_MULTIPLIER[season]),
    color: RARITY_COLORS[rarity],
  };
}
