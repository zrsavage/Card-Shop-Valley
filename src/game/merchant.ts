import type { MerchantOffer, MerchantOfferKind } from './types';

// A traveling merchant who shows up in town every so often with a small,
// non-repeating stock — gone again by the next visit, so there's a reason
// to check in rather than always being able to get the same things at the
// counter on your own schedule.

/** Rolled once per merchant visit; independent of the daily-endDay() clock
 * so a visit isn't guaranteed on any fixed cadence. */
export const MERCHANT_VISIT_CHANCE = 0.35;

interface MerchantOfferTemplate {
  kind: MerchantOfferKind;
  name: string;
  description: string;
  cost: number;
}

const MERCHANT_OFFER_TEMPLATES: MerchantOfferTemplate[] = [
  {
    kind: 'rareBundle',
    name: 'Rare Bundle',
    description: '3 cards from this season, guaranteed Rare or better.',
    cost: 180,
  },
  {
    kind: 'shinyCharm',
    name: 'Shiny Charm',
    description: 'The next pack you open is guaranteed to include a shiny.',
    cost: 150,
  },
  {
    kind: 'mythicCloseout',
    name: 'Mythic Closeout',
    description: 'A Mythic Pack, ready to open right now, at a closeout price.',
    cost: 90,
  },
];

let offerCounter = 0;

/** Picks 2 of the 3 offer kinds at random so a visit never has the exact
 * same stock every time. */
export function rollMerchantOffers(): MerchantOffer[] {
  const pool = [...MERCHANT_OFFER_TEMPLATES];
  const picked: MerchantOffer[] = [];
  for (let i = 0; i < 2 && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const template = pool.splice(idx, 1)[0];
    offerCounter += 1;
    picked.push({
      id: `merchant-${offerCounter}`,
      kind: template.kind,
      name: template.name,
      description: template.description,
      cost: template.cost,
      purchased: false,
    });
  }
  return picked;
}
