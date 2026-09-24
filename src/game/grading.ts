import type { Card } from './types';

// The Post Office's grading service: pay to ship a card off, wait a few
// days, get it back with a grade baked permanently into its value. Grades
// are weighted hard toward the middle so a top grade actually feels like a
// jackpot rather than a routine outcome — the payoff is "exponential"
// specifically because it's back-loaded onto the rarest results, not a
// flat bonus everyone gets.

export interface GradeTier {
  grade: number;
  label: string;
  valueMultiplier: number;
  /** Relative weight for the random roll — bigger means more common. */
  weight: number;
}

export const GRADE_TIERS: GradeTier[] = [
  { grade: 10, label: 'Gem Mint', valueMultiplier: 12, weight: 2 },
  { grade: 9, label: 'Mint', valueMultiplier: 6, weight: 8 },
  { grade: 8, label: 'Near Mint-Mint', valueMultiplier: 3, weight: 20 },
  { grade: 7, label: 'Near Mint', valueMultiplier: 1.8, weight: 30 },
  { grade: 5, label: 'Excellent', valueMultiplier: 1.2, weight: 25 },
  { grade: 3, label: 'Poor', valueMultiplier: 0.8, weight: 15 },
];

export function rollGrade(): GradeTier {
  const total = GRADE_TIERS.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * total;
  for (const tier of GRADE_TIERS) {
    if (roll < tier.weight) return tier;
    roll -= tier.weight;
  }
  return GRADE_TIERS[GRADE_TIERS.length - 1];
}

const GRADING_COST_FRACTION = 0.35;
const GRADING_MIN_COST = 15;

/** What it costs to submit a given card — a cut of its current value, so
 * grading a legendary is a real bet, not a rounding error. */
export function gradingCost(card: Card): number {
  return Math.max(GRADING_MIN_COST, Math.round(card.baseValue * GRADING_COST_FRACTION));
}

/** Turnaround time in days, indexed by Post Office speed tier (0 = base
 * unlock only, 1 = speedTier1, 2 = speedTier2). */
export const GRADING_TURNAROUND_DAYS = [3, 2, 1];
