import Phaser from 'phaser';
import { gameState } from './state';
import { SHOP_DOOR_TRIGGER } from './layout';
import { showFloatingText, showSpeechText } from './fx';
import { humanoidTextureKey } from './pixelArt';

const CUSTOMER_DOOR_POS = { x: SHOP_DOOR_TRIGGER.x, y: 580 };
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

export interface ShelfTarget {
  id: string;
  x: number;
  y: number;
}

// A reaction to the price tag itself, shown before the buy/no-buy roll —
// customers comment on cost independently of whether they end up buying.
const PRICE_REACTIONS: { max: number; lines: string[]; color: string }[] = [
  { max: 0.7, lines: ['What a steal!', 'Amazing price!', "Can't beat this deal!"], color: '#2b8a3e' },
  { max: 1.05, lines: ['Fair price.', 'Reasonable enough.', 'Seems about right.'], color: '#6d4c41' },
  { max: 1.5, lines: ['A bit pricey...', 'Hmm, steep.', 'Bit much for this.'], color: '#c96b18' },
  { max: Infinity, lines: ['Way too much!', "You're joking, right?", 'Not paying that.'], color: '#c92a2a' },
];

function reactionFor(ratio: number) {
  return PRICE_REACTIONS.find((r) => ratio <= r.max) ?? PRICE_REACTIONS[PRICE_REACTIONS.length - 1];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** How many different shelves this customer will check before leaving. */
function rollVisitCount(): number {
  const roll = Math.random();
  if (roll < 0.55) return 1;
  if (roll < 0.85) return 2;
  return 3;
}

function tweenTo(scene: Phaser.Scene, target: Phaser.GameObjects.Sprite, x: number, y: number, onDone: () => void) {
  const dist = Phaser.Math.Distance.Between(target.x, target.y, x, y);
  const duration = (dist / WALK_SPEED) * 1000;
  scene.tweens.add({
    targets: target,
    x,
    y,
    duration: Math.max(200, duration),
    ease: 'Sine.inOut',
    onComplete: onDone,
  });
}

export function spawnCustomer(scene: Phaser.Scene, stockedShelves: ShelfTarget[]) {
  if (stockedShelves.length === 0) return;
  const color = Phaser.Utils.Array.GetRandom(CUSTOMER_COLORS);
  const texture = humanoidTextureKey(scene, color, 28);
  const sprite = scene.add.sprite(CUSTOMER_DOOR_POS.x, CUSTOMER_DOOR_POS.y, texture).setDepth(4);
  (sprite as any).__customer = true;

  const browseOnly = Math.random() < BROWSE_ONLY_CHANCE;
  const visitPlan = Phaser.Utils.Array.Shuffle([...stockedShelves]).slice(0, browseOnly ? 1 : rollVisitCount());
  let boughtAnything = false;

  function visit(i: number) {
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
      // The Appraiser's Loupe upgrade makes customers more tolerant of markup.
      const buyChance = gameState.shopUpgrades.appraisersLoupe
        ? Phaser.Math.Clamp(1.5 - ratio * 0.65, 0.1, 0.97)
        : Phaser.Math.Clamp(1.3 - ratio * 0.8, 0.05, 0.95);
      const willBuy = Math.random() < buyChance;

      if (willBuy) {
        const earned = gameState.sellFromShelf(target.id);
        boughtAnything = true;
        showFloatingText(scene, sprite.x, sprite.y - 42, `+${earned}g`, '#2b8a3e');
      }
      scene.time.delayedCall(NEXT_SHELF_PAUSE_MS, () => visit(i + 1));
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
