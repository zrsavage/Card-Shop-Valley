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
 * can show more than just a mood, without duplicating the formula. */
export function buyChanceFor(ratio: number, appraisersLoupe: boolean): number {
  return appraisersLoupe
    ? Math.max(0.1, Math.min(0.97, 1.5 - ratio * 0.65))
    : Math.max(0.05, Math.min(0.95, 1.3 - ratio * 0.8));
}
