import { gameState, SEASONS } from './state';
import { SEASON_CARD_POOL } from './species';
import { RARITIES } from './cards';
import { FISH_SPECIES } from './fishing';

// A long-run goal beyond "more gold" — a fixed checklist tying together
// every system in the game (shop, combat, town, collection), ending in one
// capstone that represents actually "finishing" the valley's story so far.

// Every distinct card across every season and evolution stage — not just
// the 600 species lines, since each stage is its own name/rarity/card.
export const TOTAL_CARDS = SEASONS.reduce(
  (sum, season) => sum + RARITIES.reduce((s, rarity) => s + SEASON_CARD_POOL[season][rarity].length, 0),
  0,
);

export interface LegacyMilestone {
  id: string;
  name: string;
  description: string;
  check: () => boolean;
  /** Optional numeric progress for a bar, when "done or not" isn't enough. */
  progress?: () => { current: number; target: number };
}

export const LEGACY_MILESTONES: LegacyMilestone[] = [
  {
    id: 'first-sale',
    name: 'Open for Business',
    description: 'Sell your first card to a customer.',
    check: () => gameState.lifetimeCardsSold >= 1,
  },
  {
    id: 'full-shop',
    name: 'Every Shelf Full',
    description: 'Own every shelf upgrade the shop offers.',
    check: () => gameState.shopUpgrades.extraShelvesTier1 && gameState.shopUpgrades.extraShelvesTier2,
  },
  {
    id: 'deep-hollow',
    name: 'Into the Deep Hollow',
    description: 'Unlock the Deep Hollow zone.',
    check: () => gameState.unlockedZones.includes('hollow'),
  },
  {
    id: 'frostback',
    name: 'The Hardest Ground',
    description: 'Unlock the Frostback Reaches zone.',
    check: () => gameState.unlockedZones.includes('frostback'),
  },
  {
    id: 'battle-hardened',
    name: 'Battle-Hardened',
    description: 'Max out every weapon upgrade.',
    check: () =>
      gameState.combatUpgrades.weaponTier1 && gameState.combatUpgrades.weaponTier2 && gameState.combatUpgrades.weaponTier3,
  },
  {
    id: 'iron-will',
    name: 'Iron Will',
    description: 'Max out every vitality upgrade.',
    check: () =>
      gameState.combatUpgrades.vitalityTier1 && gameState.combatUpgrades.vitalityTier2 && gameState.combatUpgrades.vitalityTier3,
  },
  {
    id: 'pillar',
    name: 'Pillar of the Community',
    description: 'Repair the fountain and sponsor the festival.',
    check: () => gameState.townUpgrades.fountainRepaired && gameState.townUpgrades.festivalsUnlocked,
  },
  {
    id: 'collector',
    name: 'Collector',
    description: `Discover at least a quarter of all ${TOTAL_CARDS} cards.`,
    check: () => gameState.discoveredCards.size >= Math.ceil(TOTAL_CARDS * 0.25),
    progress: () => ({ current: gameState.discoveredCards.size, target: Math.ceil(TOTAL_CARDS * 0.25) }),
  },
  {
    id: 'fortune',
    name: 'Small Fortune',
    description: 'Earn 25,000 gold over your lifetime.',
    check: () => gameState.lifetimeGoldEarned >= 25000,
    progress: () => ({ current: Math.min(gameState.lifetimeGoldEarned, 25000), target: 25000 }),
  },
  {
    id: 'angler',
    name: 'Master Angler',
    description: `Catch all ${FISH_SPECIES.length} fish species at the fountain.`,
    check: () => Object.keys(gameState.fishCaught).length >= FISH_SPECIES.length,
    progress: () => ({ current: Object.keys(gameState.fishCaught).length, target: FISH_SPECIES.length }),
  },
];

export const LEGACY_CAPSTONE: LegacyMilestone = {
  id: 'legend',
  name: 'Legend of the Valley',
  description: 'Complete every milestone above and discover every card in the Encyclopedia.',
  check: () => LEGACY_MILESTONES.every((m) => m.check()) && gameState.discoveredCards.size >= TOTAL_CARDS,
  progress: () => ({ current: gameState.discoveredCards.size, target: TOTAL_CARDS }),
};
