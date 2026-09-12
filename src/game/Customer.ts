import Phaser from 'phaser';
import { gameState } from './state';
import { SHOP_DOOR_TRIGGER } from './layout';

const CUSTOMER_DOOR_POS = { x: SHOP_DOOR_TRIGGER.x, y: 580 };

const CUSTOMER_COLORS = [0x4cc9f0, 0xf72585, 0x90be6d, 0xf9844a, 0x9b5de5, 0x577590];
const WALK_SPEED = 130; // px/sec

function showFloatingText(scene: Phaser.Scene, x: number, y: number, text: string, color: string) {
  const t = scene.add
    .text(x, y, text, { fontSize: '14px', color, fontStyle: 'bold' })
    .setOrigin(0.5)
    .setDepth(20);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: 1100,
    ease: 'Cubic.Out',
    onComplete: () => t.destroy(),
  });
}

function tweenTo(scene: Phaser.Scene, target: Phaser.GameObjects.Arc, x: number, y: number, onDone: () => void) {
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

export function spawnCustomer(scene: Phaser.Scene, shelfId: string, shelfX: number, shelfY: number) {
  const color = Phaser.Utils.Array.GetRandom(CUSTOMER_COLORS);
  const sprite = scene.add.circle(CUSTOMER_DOOR_POS.x, CUSTOMER_DOOR_POS.y, 14, color).setDepth(4);
  (sprite as any).__customer = true;

  const approachX = shelfX + Phaser.Math.Between(-20, 20);
  const approachY = shelfY + 45;

  tweenTo(scene, sprite, approachX, approachY, () => {
    scene.time.delayedCall(500, () => {
      const shelf = gameState.shelves.find((s) => s.id === shelfId);
      if (!shelf || !shelf.card) {
        leaveShop(scene, sprite);
        return;
      }
      const value = shelf.card.baseValue;
      const price = shelf.price;
      const ratio = price / value;
      // The Appraiser's Loupe upgrade makes customers more tolerant of markup.
      const buyChance = gameState.shopUpgrades.appraisersLoupe
        ? Phaser.Math.Clamp(1.5 - ratio * 0.65, 0.1, 0.97)
        : Phaser.Math.Clamp(1.3 - ratio * 0.8, 0.05, 0.95);
      const willBuy = Math.random() < buyChance;

      if (willBuy) {
        const earned = gameState.sellFromShelf(shelfId);
        showFloatingText(scene, sprite.x, sprite.y - 20, `+${earned}g`, '#2b8a3e');
      } else {
        showFloatingText(scene, sprite.x, sprite.y - 20, `Too pricey`, '#c92a2a');
      }
      leaveShop(scene, sprite);
    });
  });
}

function leaveShop(scene: Phaser.Scene, sprite: Phaser.GameObjects.Arc) {
  scene.time.delayedCall(300, () => {
    tweenTo(scene, sprite, CUSTOMER_DOOR_POS.x, CUSTOMER_DOOR_POS.y, () => sprite.destroy());
  });
}
