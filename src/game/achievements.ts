import { gameState, bus, REPUTATION_TIERS } from './state';

// A permanent trophy case, distinct from the Legacy checklist: Legacy is a
// fixed set of per-run goals that gate the Prestige capstone (several of
// them — shelves, weapon tiers, zones — reset on Prestige and have to be
// re-earned). Achievements track lifetime totals that Prestige never
// touches, so this list only ever fills up further, run after run.

export type AchievementCategory = 'Commerce' | 'Collection' | 'Combat' | 'Fishing' | 'Community' | 'Milestones';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  check: () => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // --- Commerce ---
  {
    id: 'trader-regular',
    name: 'Regular Trader',
    description: 'Sell 50 cards over your lifetime.',
    category: 'Commerce',
    check: () => gameState.lifetimeCardsSold >= 50,
  },
  {
    id: 'trader-seasoned',
    name: 'Seasoned Merchant',
    description: 'Sell 250 cards over your lifetime.',
    category: 'Commerce',
    check: () => gameState.lifetimeCardsSold >= 250,
  },
  {
    id: 'trader-fixture',
    name: 'Market Fixture',
    description: 'Sell 1,000 cards over your lifetime.',
    category: 'Commerce',
    check: () => gameState.lifetimeCardsSold >= 1000,
  },
  {
    id: 'gold-pocket-change',
    name: 'Pocket Change',
    description: 'Earn 500 gold over your lifetime.',
    category: 'Commerce',
    check: () => gameState.lifetimeGoldEarned >= 500,
  },
  {
    id: 'gold-comfortable',
    name: 'Comfortable',
    description: 'Earn 10,000 gold over your lifetime.',
    category: 'Commerce',
    check: () => gameState.lifetimeGoldEarned >= 10000,
  },
  {
    id: 'gold-wealthy',
    name: 'Wealthy',
    description: 'Earn 100,000 gold over your lifetime.',
    category: 'Commerce',
    check: () => gameState.lifetimeGoldEarned >= 100000,
  },
  {
    id: 'gold-tycoon',
    name: 'Valley Tycoon',
    description: 'Earn 500,000 gold over your lifetime.',
    category: 'Commerce',
    check: () => gameState.lifetimeGoldEarned >= 500000,
  },
  {
    id: 'reputation-renowned',
    name: 'Renowned Shopkeep',
    description: `Reach the shop's top reputation tier, ${REPUTATION_TIERS[REPUTATION_TIERS.length - 1].name}.`,
    category: 'Commerce',
    check: () => gameState.reputationTier.name === REPUTATION_TIERS[REPUTATION_TIERS.length - 1].name,
  },

  // --- Collection ---
  {
    id: 'collection-budding',
    name: 'Budding Collection',
    description: 'Discover 25 distinct cards.',
    category: 'Collection',
    check: () => gameState.discoveredCards.size >= 25,
  },
  {
    id: 'collection-serious',
    name: 'Serious Collector',
    description: 'Discover 100 distinct cards.',
    category: 'Collection',
    check: () => gameState.discoveredCards.size >= 100,
  },
  {
    id: 'pulls-shiny-hunter',
    name: 'Shiny Hunter',
    description: 'Pull your first shiny card.',
    category: 'Collection',
    check: () => gameState.lifetimeShinyPulls >= 1,
  },
  {
    id: 'pulls-shiny-magnet',
    name: 'Shiny Magnet',
    description: 'Pull 25 shiny cards over your lifetime.',
    category: 'Collection',
    check: () => gameState.lifetimeShinyPulls >= 25,
  },
  {
    id: 'pulls-legendary-first',
    name: 'Legendary Find',
    description: 'Pull your first legendary card.',
    category: 'Collection',
    check: () => gameState.lifetimeLegendaryPulls >= 1,
  },
  {
    id: 'pulls-legendary-farmer',
    name: 'Legend Farmer',
    description: 'Pull 25 legendary cards over your lifetime.',
    category: 'Collection',
    check: () => gameState.lifetimeLegendaryPulls >= 25,
  },
  {
    id: 'packs-rat',
    name: 'Pack Rat',
    description: 'Open 50 packs over your lifetime.',
    category: 'Collection',
    check: () => gameState.lifetimePacksOpened >= 50,
  },
  {
    id: 'packs-fiend',
    name: 'Pack Fiend',
    description: 'Open 500 packs over your lifetime.',
    category: 'Collection',
    check: () => gameState.lifetimePacksOpened >= 500,
  },

  // --- Combat ---
  {
    id: 'combat-first-blood',
    name: 'First Blood',
    description: 'Defeat your first enemy in the Wilds.',
    category: 'Combat',
    check: () => gameState.lifetimeEnemiesDefeated >= 1,
  },
  {
    id: 'combat-hunter',
    name: 'Monster Hunter',
    description: 'Defeat 250 enemies over your lifetime.',
    category: 'Combat',
    check: () => gameState.lifetimeEnemiesDefeated >= 250,
  },
  {
    id: 'combat-warlord',
    name: 'Wilds Warlord',
    description: 'Defeat 1,000 enemies over your lifetime.',
    category: 'Combat',
    check: () => gameState.lifetimeEnemiesDefeated >= 1000,
  },

  // --- Fishing ---
  {
    id: 'fishing-first-catch',
    name: 'Wet a Line',
    description: 'Catch your first fish at the fountain.',
    category: 'Fishing',
    check: () => gameState.lifetimeFishCaught >= 1,
  },
  {
    id: 'fishing-committed',
    name: 'Committed Angler',
    description: 'Catch 200 fish over your lifetime.',
    category: 'Fishing',
    check: () => gameState.lifetimeFishCaught >= 200,
  },

  // --- Community ---
  {
    id: 'gifts-generous',
    name: 'Generous',
    description: 'Gift 10 cards to townsfolk over your lifetime.',
    category: 'Community',
    check: () => gameState.lifetimeGiftsGiven >= 10,
  },
  {
    id: 'gifts-beloved',
    name: 'Beloved Neighbor',
    description: 'Gift 100 cards to townsfolk over your lifetime.',
    category: 'Community',
    check: () => gameState.lifetimeGiftsGiven >= 100,
  },

  // --- Milestones ---
  {
    id: 'time-week',
    name: 'A Week in the Valley',
    description: 'Play for 7 days total.',
    category: 'Milestones',
    check: () => gameState.lifetimeDaysPlayed >= 7,
  },
  {
    id: 'time-season',
    name: 'A Season Survived',
    description: 'Play for 28 days total.',
    category: 'Milestones',
    check: () => gameState.lifetimeDaysPlayed >= 28,
  },
  {
    id: 'time-year',
    name: 'One Year In',
    description: 'Play for 112 days total.',
    category: 'Milestones',
    check: () => gameState.lifetimeDaysPlayed >= 112,
  },
  {
    id: 'prestige-reborn',
    name: 'Reborn',
    description: 'Prestige for the first time.',
    category: 'Milestones',
    check: () => gameState.prestigeLevel >= 1,
  },
  {
    id: 'prestige-ascendant',
    name: 'Ascendant',
    description: 'Reach Prestige Level 5.',
    category: 'Milestones',
    check: () => gameState.prestigeLevel >= 5,
  },
];

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = ['Commerce', 'Collection', 'Combat', 'Fishing', 'Community', 'Milestones'];

/** Scans for any achievement that's now true but not yet recorded as
 * unlocked, records it, and fires 'achievement-unlocked' for each so the UI
 * can toast it — called from a handful of bus events that already fire on
 * every relevant state change (see initUI()), so this never needs its own
 * call sites sprinkled through state.ts. */
export function checkAchievements(): Achievement[] {
  const unlocked: Achievement[] = [];
  for (const a of ACHIEVEMENTS) {
    if (gameState.unlockedAchievementIds.has(a.id)) continue;
    if (a.check()) {
      gameState.unlockedAchievementIds.add(a.id);
      unlocked.push(a);
    }
  }
  if (unlocked.length > 0) {
    for (const a of unlocked) bus.emit('achievement-unlocked', a);
  }
  return unlocked;
}
