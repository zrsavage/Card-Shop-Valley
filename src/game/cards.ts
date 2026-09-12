import type { Card, Rarity, Season } from './types';
import { SEASON_CARD_POOL, STAGE_VALUE_MULTIPLIER } from './species';

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

let cardCounter = 0;

export function generateCard(rarity: Rarity, season: Season): Card {
  const pool = SEASON_CARD_POOL[season][rarity];
  const template = pool[Math.floor(Math.random() * pool.length)];
  const valueJitter = 0.85 + Math.random() * 0.3;
  const stageMultiplier = STAGE_VALUE_MULTIPLIER[template.stage - 1];
  cardCounter += 1;
  return {
    id: `card-${Date.now()}-${cardCounter}`,
    name: template.name,
    rarity,
    season,
    speciesId: template.speciesId,
    stage: template.stage,
    stageCount: template.stageCount,
    baseValue: Math.round(RARITY_BASE_VALUE[rarity] * valueJitter * SEASON_PRICE_MULTIPLIER[season] * stageMultiplier),
    color: RARITY_COLORS[rarity],
  };
}
