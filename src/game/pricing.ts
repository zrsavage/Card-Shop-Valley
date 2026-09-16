// Shared price-reaction thresholds — the single source of truth for "is
// this price a good deal or a rip-off," used both by customer dialogue
// (Customer.ts) and the live pricing preview shown while stocking a shelf.

export interface PriceReactionTier {
  /** Upper bound of price/value ratio this tier covers. */
  maxRatio: number;
  label: string;
  /** Hex color for Phaser text. */
  colorHex: string;
  /** CSS class for the DOM preview badge. */
  cssClass: string;
}

export const PRICE_REACTION_TIERS: PriceReactionTier[] = [
  { maxRatio: 0.7, label: 'Great deal', colorHex: '#2b8a3e', cssClass: 'price-tier-steal' },
  { maxRatio: 1.05, label: 'Fair price', colorHex: '#6d4c41', cssClass: 'price-tier-fair' },
  { maxRatio: 1.5, label: 'A bit pricey', colorHex: '#c96b18', cssClass: 'price-tier-pricey' },
  { maxRatio: Infinity, label: 'Too expensive', colorHex: '#c92a2a', cssClass: 'price-tier-toomuch' },
];

export function priceReactionFor(ratio: number): PriceReactionTier {
  return PRICE_REACTION_TIERS.find((t) => ratio <= t.maxRatio) ?? PRICE_REACTION_TIERS[PRICE_REACTION_TIERS.length - 1];
}

/** Same odds Customer.ts rolls against — surfaced so the pricing preview
 * can show more than just a mood, without duplicating the formula.
 * `silverTongue` (the Commerce perk) stacks an extra flat tolerance bonus
 * on top of whatever the loupe already gives. */
export function buyChanceFor(ratio: number, appraisersLoupe: boolean, silverTongue = false): number {
  const base = appraisersLoupe ? 1.5 : 1.3;
  const slope = appraisersLoupe ? 0.65 : 0.8;
  const bonus = silverTongue ? 0.15 : 0;
  const floor = appraisersLoupe ? 0.1 : 0.05;
  return Math.max(floor, Math.min(0.97, base + bonus - ratio * slope));
}
