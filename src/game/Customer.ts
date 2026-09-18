import Phaser from 'phaser';
import { gameState } from './state';
import { SHOP_DOOR_TRIGGER, REGISTER_QUEUE_POS, REGISTER_QUEUE_SPACING } from './layout';
import { showFloatingText, showSpeechText } from './fx';
import { humanoidTextureKey } from './pixelArt';
import { PRICE_REACTION_TIERS, buyChanceFor } from './pricing';
import { playCoin, playFootstepFaint } from './audio';
import type { Card } from './types';

const CUSTOMER_DOOR_POS = { x: SHOP_DOOR_TRIGGER.x, y: 580 };

/** A customer who's decided to buy something waits here, in line, until the
 * player rings them up at the register and haggles over the price — they
 * don't just pay and walk off on their own. */
export interface CheckoutTicket {
  id: number;
  scene: Phaser.Scene;
  sprite: Phaser.GameObjects.Sprite;
  shelfId: string;
  card: Card;
  /** The shelf's listed price — the haggle's opening reference point, not
   * necessarily what they end up paying. */
  price: number;
  archetype: 'normal' | 'bulkBuyer' | 'bigSpender';
  /** Continues that customer's own visit flow (next shelf, or leaving).
   * A null finalPrice means the haggle fell through — no sale. */
  resolve: (finalPrice: number | null) => void;
}

let nextTicketId = 1;
export const checkoutQueue: CheckoutTicket[] = [];

function repositionQueue() {
  checkoutQueue.forEach((ticket, idx) => {
    const y = REGISTER_QUEUE_POS.y + idx * REGISTER_QUEUE_SPACING;
    ticket.scene.tweens.add({ targets: ticket.sprite, x: REGISTER_QUEUE_POS.x, y, duration: 300, ease: 'Sine.inOut' });
  });
}

/** Called by the register's haggle UI once a price is actually agreed on —
 * settles the sale at that price and lets the customer continue (or leave,
 * if the register was their last stop). */
export function completeCheckout(ticketId: number, finalPrice: number) {
  const idx = checkoutQueue.findIndex((t) => t.id === ticketId);
  if (idx < 0) return;
  const [ticket] = checkoutQueue.splice(idx, 1);
  const earned = gameState.completeReservedSale(finalPrice, 1);
  showFloatingText(ticket.scene, ticket.sprite.x, ticket.sprite.y - 42, `+${earned}g`, '#2b8a3e');
  playCoin();
  repositionQueue();
  ticket.resolve(finalPrice);
}

/** Called when the haggle falls through — the customer leaves empty-handed
 * and the card goes back on the shelf (or the bag, if the shelf's since
 * been restocked with something else) rather than being lost. */
export function walkAwayFromCheckout(ticketId: number) {
  const idx = checkoutQueue.findIndex((t) => t.id === ticketId);
  if (idx < 0) return;
  const [ticket] = checkoutQueue.splice(idx, 1);
  if (!gameState.returnCardToShelf(ticket.shelfId, ticket.card, ticket.price)) {
    gameState.addCardsToInventory([ticket.card]);
  }
  showFloatingText(ticket.scene, ticket.sprite.x, ticket.sprite.y - 42, `Deal fell through`, '#c92a2a');
  repositionQueue();
  ticket.resolve(null);
}

/** Called when the shop is left (day ends, or the scene itself is torn
 * down) — queued customers don't persist across a scene reload. Anyone
 * still waiting had their card reserved off a shelf, so it's restored
 * (shelf, or the bag if that shelf's occupied) rather than just vanishing. */
export function clearCheckoutQueue() {
  for (const ticket of checkoutQueue) {
    if (!gameState.returnCardToShelf(ticket.shelfId, ticket.card, ticket.price)) {
      gameState.addCardsToInventory([ticket.card]);
    }
  }
  checkoutQueue.length = 0;
}
const CUSTOMER_COLORS = [0x4cc9f0, 0xf72585, 0x90be6d, 0xf9844a, 0x9b5de5, 0x577590];
const WALK_SPEED = 130; // px/sec

// Some customers never intend to buy anything — they just came to look.
const BROWSE_ONLY_CHANCE = 0.15;
// Paced so each speech bubble (visible ~2.6s, see showSpeechText) has time
// to actually be read before the customer moves on or leaves.
const LOOK_PAUSE_MS = 1600;
const DECIDE_PAUSE_MS = 1500;
const NEXT_SHELF_PAUSE_MS = 500;
const LEAVE_PAUSE_MS = 900;
const CUSTOMER_STEP_INTERVAL_MS = 320;

export interface ShelfTarget {
  id: string;
  x: number;
  y: number;
}

// A reaction to the price tag itself, shown before the buy/no-buy roll —
// customers comment on cost independently of whether they end up buying.
// Thresholds/colors come from pricing.ts (shared with the shelf-price
// preview); only the flavor lines live here.
const REACTION_LINES: string[][] = [
  ['What a steal!', 'Amazing price!', "Can't beat this deal!"],
  ['Fair price.', 'Reasonable enough.', 'Seems about right.'],
  ['A bit pricey...', 'Hmm, steep.', 'Bit much for this.'],
  ['Way too much!', "You're joking, right?", 'Not paying that.'],
];

function reactionFor(ratio: number) {
  const idx = PRICE_REACTION_TIERS.findIndex((t) => ratio <= t.maxRatio);
  const tier = PRICE_REACTION_TIERS[idx < 0 ? PRICE_REACTION_TIERS.length - 1 : idx];
  const lines = REACTION_LINES[idx < 0 ? REACTION_LINES.length - 1 : idx];
  return { lines, color: tier.colorHex };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** How many different shelves this customer will check before leaving —
 * always at least 2 for anyone actually buying, so a customer with money
 * left doesn't just grab the first cheap card and walk out. Actual
 * purchases are further capped by their budget (see rollBudget below). */
function rollMaxVisits(archetype: 'normal' | 'bulkBuyer' | 'bigSpender'): number {
  if (archetype === 'bulkBuyer') return Phaser.Math.Between(4, 5);
  if (archetype === 'bigSpender') return Phaser.Math.Between(2, 3);
  return Phaser.Math.Between(2, 3);
}

/** A rough gold budget for this visit — high/low so they keep shopping
 * until it's spent instead of stopping after one purchase. */
function rollBudget(archetype: 'normal' | 'bulkBuyer' | 'bigSpender'): number {
  if (archetype === 'bigSpender') return Phaser.Math.Between(250, 600);
  if (archetype === 'bulkBuyer') return Phaser.Math.Between(150, 350);
  return Phaser.Math.Between(50, 180);
}

// Below this, a customer with money left still calls it quits rather than
// wandering shelves they can no longer afford anything from.
const MIN_BROWSE_BUDGET = 5;

function tweenTo(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite, x: number, y: number, onDone: () => void) {
  const dist = Phaser.Math.Distance.Between(target.x, target.y, x, y);
  const duration = Math.max(200, (dist / WALK_SPEED) * 1000);
  // A faint, periodic step sound while actually walking somewhere — skipped
  // for near-zero-distance "moves". Cleaned up on the sprite's own destroy
  // event too, since a customer can be force-removed (day ending) mid-walk,
  // which stops the tween without necessarily firing its onComplete.
  let stepEvent: Phaser.Time.TimerEvent | null = null;
  if (dist > 4) {
    stepEvent = scene.time.addEvent({ delay: CUSTOMER_STEP_INTERVAL_MS, loop: true, callback: playFootstepFaint });
    target.once(Phaser.GameObjects.Events.DESTROY, () => stepEvent?.remove());
  }
  scene.tweens.add({
    targets: target,
    x,
    y,
    duration,
    ease: 'Sine.inOut',
    onComplete: () => {
      stepEvent?.remove();
      onDone();
    },
  });
}

/** Higher shop reputation unlocks customer archetypes beyond the default
 * browse-or-buy visitor — a big spender who barely blinks at a markup, or a
 * bulk buyer who checks nearly every shelf instead of just one or two. */
function rollArchetype(): 'normal' | 'bulkBuyer' | 'bigSpender' {
  const tier = gameState.reputationTier;
  // The Bulk Relations perk splits its bonus evenly across both archetypes.
  const perkBonus = gameState.bulkRelationsBonus / 2;
  const bigSpenderChance = tier.bigSpenderChance + perkBonus;
  const bulkBuyerChance = tier.bulkBuyerChance + perkBonus;
  const roll = Math.random();
  if (roll < bigSpenderChance) return 'bigSpender';
  if (roll < bigSpenderChance + bulkBuyerChance) return 'bulkBuyer';
  return 'normal';
}

export function spawnCustomer(scene: Phaser.Scene, stockedShelves: ShelfTarget[]) {
  if (stockedShelves.length === 0) return;
  const color = Phaser.Utils.Array.GetRandom(CUSTOMER_COLORS);
  const texture = humanoidTextureKey(scene, color, 28);
  const sprite = scene.add.sprite(CUSTOMER_DOOR_POS.x, CUSTOMER_DOOR_POS.y, texture).setDepth(4);
  (sprite as any).__customer = true;

  const archetype = rollArchetype();
  if (archetype !== 'normal') {
    const label = archetype === 'bigSpender' ? 'Big Spender!' : 'Bulk Buyer!';
    showFloatingText(scene, sprite.x, sprite.y - 40, label, '#ffd166', 1300);
  }

  const browseOnly = archetype === 'normal' && Math.random() < BROWSE_ONLY_CHANCE;
  const maxVisits = browseOnly ? 1 : Math.min(stockedShelves.length, rollMaxVisits(archetype));
  const visitPlan = Phaser.Utils.Array.Shuffle([...stockedShelves]).slice(0, maxVisits);
  let boughtAnything = false;
  let budgetRemaining = browseOnly ? 0 : rollBudget(archetype);

  function visit(i: number) {
    // Out of money worth spending — stop wandering shelves instead of
    // finishing out a visit plan they can no longer afford.
    if (!browseOnly && i > 0 && budgetRemaining < MIN_BROWSE_BUDGET) {
      leaveShop(boughtAnything);
      return;
    }
    if (i >= visitPlan.length) {
      leaveShop(boughtAnything);
      return;
    }
    const target = visitPlan[i];
    const approachX = target.x + Phaser.Math.Between(-20, 20);
    const approachY = target.y + 45;
    tweenTo(scene, sprite, approachX, approachY, () => {
      scene.time.delayedCall(200, () => resolveVisit(target, i));
    });
  }

  function resolveVisit(target: ShelfTarget, i: number) {
    const shelf = gameState.shelves.find((s) => s.id === target.id);
    if (!shelf || !shelf.card) {
      visit(i + 1);
      return;
    }

    if (browseOnly) {
      showSpeechText(scene, sprite.x, sprite.y - 20, pick(['Just browsing.', 'Not today.', 'Maybe next time.']), '#6d4c41');
      scene.time.delayedCall(LOOK_PAUSE_MS, () => visit(i + 1));
      return;
    }

    const value = shelf.card.baseValue;
    const price = shelf.price;
    const ratio = price / value;
    const reaction = reactionFor(ratio);
    showSpeechText(scene, sprite.x, sprite.y - 20, pick(reaction.lines), reaction.color);

    scene.time.delayedCall(DECIDE_PAUSE_MS, () => {
      // A big spender reacts to the sticker price the same as anyone else
      // (the speech line above is unaffected), but is far more forgiving
      // when it actually comes to paying it.
      const effectiveRatio = archetype === 'bigSpender' ? ratio * 0.6 : ratio;
      const buyChance = buyChanceFor(effectiveRatio, gameState.shopUpgrades.appraisersLoupe, gameState.hasPerk('silverTongue'));
      // Budget gates the purchase outright, on top of (not instead of) the
      // usual price-fairness roll — a great deal they can't actually afford
      // still doesn't sell.
      const canAfford = price <= budgetRemaining;
      const willBuy = canAfford && Math.random() < buyChance;

      if (willBuy) {
        const reserved = gameState.reserveShelfForSale(target.id);
        if (!reserved) {
          // Someone else got there first — nothing to buy after all.
          scene.time.delayedCall(NEXT_SHELF_PAUSE_MS, () => visit(i + 1));
          return;
        }
        showSpeechText(scene, sprite.x, sprite.y - 20, pick(["I'll take it!", "Ringing this up.", "Ready to pay."]), '#2b8a3e');
        goToRegister(target.id, reserved.card, reserved.price, (finalPrice) => {
          // Budget and the "thanks!" line are only earned on an actual
          // completed sale — the haggle can still fall through at the
          // register, in which case nothing here should have happened.
          if (finalPrice != null) {
            budgetRemaining -= finalPrice;
            boughtAnything = true;
          }
          visit(i + 1);
        });
        return;
      } else if (!canAfford) {
        showFloatingText(scene, sprite.x, sprite.y - 42, `Can't afford that`, '#c92a2a');
      }
      scene.time.delayedCall(NEXT_SHELF_PAUSE_MS, () => visit(i + 1));
    });
  }

  /** Walks to the back of the checkout line and waits — no timeout, the
   * player has to actually come ring them up (and haggle) to get paid. */
  function goToRegister(shelfId: string, card: Card, price: number, onDone: (finalPrice: number | null) => void) {
    const queueIdx = checkoutQueue.length;
    const targetX = REGISTER_QUEUE_POS.x;
    const targetY = REGISTER_QUEUE_POS.y + queueIdx * REGISTER_QUEUE_SPACING;
    tweenTo(scene, sprite, targetX, targetY, () => {
      checkoutQueue.push({ id: nextTicketId++, scene, sprite, shelfId, card, price, archetype, resolve: onDone });
    });
  }

  function leaveShop(bought: boolean) {
    if (bought) {
      showSpeechText(scene, sprite.x, sprite.y - 20, pick(['Thanks!', 'Pleasure doing business!', 'Love this find!']), '#2b8a3e');
    }
    scene.time.delayedCall(LEAVE_PAUSE_MS, () => {
      tweenTo(scene, sprite, CUSTOMER_DOOR_POS.x, CUSTOMER_DOOR_POS.y, () => sprite.destroy());
    });
  }

  visit(0);
}
