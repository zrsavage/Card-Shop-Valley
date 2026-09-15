import type { BoardObjective } from './types';

// Daily objectives posted at the Town Hall — regenerated (unclaimed rewards
// lost) every time the day ends, so there's a reason to swing by and check
// what's on the board before ending the day rather than just farming
// whichever loop is most gold-efficient.

interface ObjectiveTemplate {
  metric: BoardObjective['metric'];
  describe: (target: number) => string;
  targets: number[];
  goldPerUnit: number;
}

const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  {
    metric: 'cardsSold',
    describe: (n) => `Sell ${n} card${n === 1 ? '' : 's'} to customers`,
    targets: [3, 5, 8],
    goldPerUnit: 9,
  },
  {
    metric: 'enemiesDefeated',
    describe: (n) => `Defeat ${n} enemies in the Wilds`,
    targets: [4, 6, 10],
    goldPerUnit: 11,
  },
  {
    metric: 'giftsGiven',
    describe: (n) => `Gift ${n} card${n === 1 ? '' : 's'} to townsfolk`,
    targets: [1, 2],
    goldPerUnit: 45,
  },
  {
    metric: 'packsOpened',
    describe: (n) => `Open ${n} pack${n === 1 ? '' : 's'}`,
    targets: [1, 2, 3],
    goldPerUnit: 28,
  },
  {
    metric: 'goldEarned',
    describe: (n) => `Earn ${n}g from shop sales today`,
    targets: [50, 100, 150],
    goldPerUnit: 0.55,
  },
  {
    metric: 'fishCaught',
    describe: (n) => `Catch ${n} fish at the fountain`,
    targets: [2, 3, 5],
    goldPerUnit: 14,
  },
];

let objectiveCounter = 0;

/** Rolls 3 objectives against distinct metrics so a day's board always
 * touches a spread of the game's systems rather than three of the same thing.
 * Fishing only enters the pool once the fountain's actually usable, so a
 * fresh save is never handed an objective it has no way to complete yet. */
export function rollTownBoard(fountainRepaired: boolean): BoardObjective[] {
  const pool = OBJECTIVE_TEMPLATES.filter((t) => t.metric !== 'fishCaught' || fountainRepaired);
  const picked: BoardObjective[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const template = pool.splice(idx, 1)[0];
    const target = template.targets[Math.floor(Math.random() * template.targets.length)];
    objectiveCounter += 1;
    picked.push({
      id: `board-${objectiveCounter}`,
      description: template.describe(target),
      metric: template.metric,
      target,
      reward: Math.max(5, Math.round(target * template.goldPerUnit)),
      claimed: false,
    });
  }
  return picked;
}
