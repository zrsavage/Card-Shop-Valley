import Phaser from 'phaser';
import { gameState, bus } from '../game/state';
import { spawnCustomer, checkoutQueue, clearCheckoutQueue, completeCheckout, NO_HAGGLE_BELOW_PRICE } from '../game/Customer';
import { COUNTER_POS, COUNTER_BEHIND_POS, SHOP_ENTRANCE_POS, SHOP_DOOR_TRIGGER, SHOP_SHELF_POSITIONS } from '../game/layout';
import type { ShelfPosition } from '../game/layout';
import { playerTextureKey, attachCircleBody, WalkAnimator } from '../game/pixelArt';
import { woodTextureKey } from '../game/sceneryArt';
import { DECOR_ITEMS, type DecorDef } from '../game/decor';
import { playFootstep } from '../game/audio';

const INTERACT_RANGE = 70;
const STEP_INTERVAL_MS = 300;

interface ShelfVisual {
  id: string;
  x: number;
  y: number;
  cardIcon: Phaser.GameObjects.Arc;
  priceTag: Phaser.GameObjects.Text;
  emptyLabel: Phaser.GameObjects.Text;
}

export default class ShopScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private promptText!: Phaser.GameObjects.Text;
  private shelfVisuals: ShelfVisual[] = [];
  private customerSpawnTimer = 0;
  private nextSpawnAt = 3000;
  private decorVisuals = new Set<string>();
  private stepTimer = 0;
  private walkAnim = new WalkAnimator();

  constructor() {
    super('Shop');
  }

  create() {
    this.cameras.main.setBackgroundColor('#3e2723');
    this.shelfVisuals = [];
    this.customerSpawnTimer = 0;
    this.nextSpawnAt = 2000;
    this.decorVisuals = new Set();
    this.stepTimer = 0;

    // Floor — a warm wood-plank tile instead of one flat rectangle.
    const floorKey = woodTextureKey(this, 0xe8d5b7);
    this.add.tileSprite(400, 300, 760, 560, floorKey).setDepth(0);
    // Door gap (walk down through here to reach the town)
    this.add.rectangle(SHOP_DOOR_TRIGGER.x, 598, 100, 8, 0x4a3728).setDepth(1);
    this.add
      .text(SHOP_DOOR_TRIGGER.x, 575, 'TOWN ▼', { fontSize: '11px', color: '#a1887f' })
      .setOrigin(0.5)
      .setDepth(1);

    // Counter — a darker wood grain than the floor, plus a brass trim rail.
    const counterWoodKey = woodTextureKey(this, 0x6f4e37);
    this.add.tileSprite(COUNTER_POS.x, COUNTER_POS.y, 180, 60, counterWoodKey).setDepth(2);
    this.add.rectangle(COUNTER_POS.x, COUNTER_POS.y, 180, 60, 0x000000, 0).setDepth(2).setStrokeStyle(3, 0x2b1d0e);
    this.add.rectangle(COUNTER_POS.x, COUNTER_POS.y - 22, 180, 14, 0xd9a066).setDepth(2).setStrokeStyle(1, 0x8a6a1a);
    this.add
      .text(COUNTER_POS.x, COUNTER_POS.y, 'REGISTER', { fontSize: '14px', color: '#fff5e1', align: 'center' })
      .setOrigin(0.5)
      .setDepth(3);
    const counterBody = this.physics.add.staticBody(COUNTER_POS.x - 90, COUNTER_POS.y - 30, 180, 60);

    // A small mat marking the staff-only side — the counter's solid body
    // blocks a straight shot through it, so actually working the register
    // means walking around one end to reach this spot.
    this.add.rectangle(COUNTER_BEHIND_POS.x, COUNTER_BEHIND_POS.y, 70, 40, 0x4a3728, 0.5).setDepth(1).setStrokeStyle(1, 0x2b1d0e, 0.5);
    this.add
      .text(COUNTER_BEHIND_POS.x, COUNTER_BEHIND_POS.y, 'STAFF', { fontSize: '10px', color: '#d9a066' })
      .setOrigin(0.5)
      .setDepth(1);

    // Shelves — base six always present; upgrade-unlocked ones appear as they're purchased.
    const shelfBodies: Phaser.Physics.Arcade.StaticBody[] = [];
    SHOP_SHELF_POSITIONS.forEach((pos, i) => {
      if (this.isShelfUnlocked(pos)) {
        shelfBodies.push(this.createShelfVisual(pos, i));
      }
    });

    // Player
    const playerTexture = playerTextureKey(this, gameState.equippedOutfitColor, 32);
    this.player = this.add.sprite(SHOP_ENTRANCE_POS.x, SHOP_ENTRANCE_POS.y, playerTexture).setDepth(5);
    this.physics.add.existing(this.player);
    attachCircleBody(this.player, 16);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.world.setBounds(30, 30, 740, 540);

    this.physics.add.collider(this.player, counterBody);
    shelfBodies.forEach((b) => this.physics.add.collider(this.player, b));

    this.promptText = this.add
      .text(0, 0, '', { fontSize: '13px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey('W'),
      down: this.input.keyboard!.addKey('S'),
      left: this.input.keyboard!.addKey('A'),
      right: this.input.keyboard!.addKey('D'),
    };
    this.interactKey = this.input.keyboard!.addKey('E');

    this.refreshShelfVisuals();
    this.refreshDecor();
    bus.on('shelves-changed', this.refreshShelfVisuals, this);
    bus.on('shop-upgrades-changed', this.onUpgradesChanged, this);
    bus.on('paused-changed', this.onPausedChanged, this);
    bus.on('day-summary', this.onDaySummary, this);
    bus.on('cosmetics-changed', this.onCosmeticsChanged, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('shelves-changed', this.refreshShelfVisuals, this);
      bus.off('shop-upgrades-changed', this.onUpgradesChanged, this);
      bus.off('paused-changed', this.onPausedChanged, this);
      bus.off('day-summary', this.onDaySummary, this);
      bus.off('cosmetics-changed', this.onCosmeticsChanged, this);
      // Customers waiting at the register don't survive leaving the shop —
      // their sprites are about to be destroyed along with the rest of the
      // scene's display list, so drop any stale tickets pointing at them.
      clearCheckoutQueue();
    });
  }

  private onCosmeticsChanged() {
    this.player.setTexture(playerTextureKey(this, gameState.equippedOutfitColor, 32));
    this.refreshDecor();
  }

  /** Purely cosmetic gold sinks — once bought, a decoration is drawn once
   * and stays, no placement UI needed. */
  private refreshDecor() {
    for (const item of DECOR_ITEMS) {
      if (!gameState.ownedDecor.includes(item.id)) continue;
      if (this.decorVisuals.has(item.id)) continue;
      this.decorVisuals.add(item.id);
      this.drawDecor(item);
    }
  }

  private drawDecor(item: DecorDef) {
    switch (item.kind) {
      case 'rug':
        this.add.rectangle(item.x, item.y, 140, 90, item.color, 0.55).setDepth(0).setStrokeStyle(2, 0x2b1d0e, 0.4);
        break;
      case 'plant':
        this.add.rectangle(item.x, item.y + 14, 20, 16, 0x6d4c41).setDepth(2);
        this.add.circle(item.x, item.y - 6, 16, item.color).setDepth(2);
        break;
      case 'banner':
        this.add.rectangle(item.x, item.y - 20, 50, 8, 0x5d4037).setDepth(2);
        this.add.rectangle(item.x, item.y + 8, 44, 34, item.color).setDepth(2).setStrokeStyle(2, 0x2b1d0e);
        break;
      case 'lantern':
        this.add.circle(item.x, item.y, 22, item.color, 0.25).setDepth(2);
        this.add.circle(item.x, item.y, 10, item.color).setDepth(3).setStrokeStyle(2, 0x2b1d0e);
        break;
      case 'trophyCase':
        this.add.rectangle(item.x, item.y, 46, 60, 0x6d4c41).setDepth(2).setStrokeStyle(2, 0x2b1d0e);
        this.add.rectangle(item.x, item.y + 8, 20, 26, item.color).setDepth(3);
        break;
    }
  }

  private isShelfUnlocked(pos: ShelfPosition): boolean {
    if (pos.requires === null) return true;
    if (pos.requires === 'tier1') return gameState.shopUpgrades.extraShelvesTier1;
    return gameState.shopUpgrades.extraShelvesTier2;
  }

  private createShelfVisual(pos: ShelfPosition, index: number): Phaser.Physics.Arcade.StaticBody {
    const id = `shelf-${index}`;
    const shelfWoodKey = woodTextureKey(this, 0x8d6e63);
    this.add.tileSprite(pos.x, pos.y, 90, 70, shelfWoodKey).setDepth(2);
    this.add.rectangle(pos.x, pos.y, 90, 70, 0x000000, 0).setDepth(2).setStrokeStyle(3, 0x5d4037);
    // A shelf "lip" board partway down reads as an actual shelf, not a box.
    this.add.rectangle(pos.x, pos.y + 14, 82, 4, 0x5d4037).setDepth(2);
    const cardIcon = this.add.circle(pos.x, pos.y - 8, 22, 0xffffff, 0).setDepth(3);
    const priceTag = this.add
      .text(pos.x, pos.y + 26, '', { fontSize: '13px', color: '#2b1d0e', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(3);
    const emptyLabel = this.add
      .text(pos.x, pos.y - 8, 'empty', { fontSize: '12px', color: '#a1887f' })
      .setOrigin(0.5)
      .setDepth(3);
    this.shelfVisuals.push({ id, x: pos.x, y: pos.y, cardIcon, priceTag, emptyLabel });
    return this.physics.add.staticBody(pos.x - 45, pos.y - 35, 90, 70);
  }

  private onUpgradesChanged() {
    const existingIds = new Set(this.shelfVisuals.map((v) => v.id));
    SHOP_SHELF_POSITIONS.forEach((pos, i) => {
      const id = `shelf-${i}`;
      if (existingIds.has(id)) return;
      if (!this.isShelfUnlocked(pos)) return;
      const body = this.createShelfVisual(pos, i);
      if (this.player) this.physics.add.collider(this.player, body);
    });
    this.refreshShelfVisuals();
  }

  private onPausedChanged(paused: boolean) {
    if (paused) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  private onDaySummary() {
    this.children.list.filter((c) => (c as any).__customer).forEach((c) => (c as any).destroy?.());
    clearCheckoutQueue();
  }

  private refreshShelfVisuals() {
    for (const visual of this.shelfVisuals) {
      const shelf = gameState.shelves.find((s) => s.id === visual.id)!;
      if (shelf.card) {
        visual.cardIcon.setFillStyle(shelf.card.color, 1);
        visual.priceTag.setText(`${shelf.price}g`);
        visual.emptyLabel.setVisible(false);
      } else {
        visual.cardIcon.setFillStyle(0xffffff, 0);
        visual.priceTag.setText('');
        visual.emptyLabel.setVisible(true);
      }
    }
  }

  update(_time: number, delta: number) {
    if (!gameState.paused) {
      const moving = this.handleMovement();
      this.walkAnim.update(this.player, moving, delta);
      this.tickFootsteps(moving, delta);
      this.handleInteract();
      this.handleDoorTrigger();
      gameState.tickEnergy(delta);
      gameState.tickShopAutomation(delta);
      this.tickCustomerSpawns(delta);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private handleMovement(): boolean {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown || this.wasd.left.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.wasd.right.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.wasd.up.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.wasd.down.isDown) vy += 1;
    const vec = new Phaser.Math.Vector2(vx, vy);
    const moving = vec.length() > 0;
    if (moving) vec.normalize();
    const speed = gameState.moveSpeed;
    body.setVelocity(vec.x * speed, vec.y * speed);
    return moving;
  }

  private tickFootsteps(moving: boolean, delta: number) {
    if (!moving) {
      this.stepTimer = 0;
      return;
    }
    this.stepTimer += delta;
    if (this.stepTimer >= STEP_INTERVAL_MS) {
      this.stepTimer = 0;
      playFootstep();
    }
  }

  private handleDoorTrigger() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, SHOP_DOOR_TRIGGER.x, SHOP_DOOR_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Town', { from: 'shop' });
    }
  }

  private nearestInteractable(): { type: 'counter' | 'shelf'; id?: string; x: number; y: number } | null {
    // The register's interact point is the staff side behind the counter,
    // not the counter's own (customer-facing) center — its solid body
    // keeps the front of the counter out of that range, so ringing anyone
    // up means actually walking around to the back.
    const candidates: { type: 'counter' | 'shelf'; id?: string; x: number; y: number }[] = [
      { type: 'counter', x: COUNTER_BEHIND_POS.x, y: COUNTER_BEHIND_POS.y },
      ...this.shelfVisuals.map((v) => ({ type: 'shelf' as const, id: v.id, x: v.x, y: v.y })),
    ];
    let best: { type: 'counter' | 'shelf'; id?: string; x: number; y: number } | null = null;
    let bestDist = INTERACT_RANGE;
    for (const c of candidates) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, c.x, c.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  private handleInteract() {
    const target = this.nearestInteractable();
    if (target) {
      const label =
        target.type === 'counter'
          ? checkoutQueue.length > 0
            ? checkoutQueue[0].price < NO_HAGGLE_BELOW_PRICE
              ? 'Press E: Quick Sale'
              : 'Press E: Ring Up Customer'
            : 'Press E: Register'
          : 'Press E: Manage Shelf';
      this.promptText.setText(label).setPosition(target.x, target.y - 55).setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (!target) {
        bus.emit('open-menu');
      } else if (target.type === 'counter') {
        if (checkoutQueue.length > 0) {
          const ticket = checkoutQueue[0];
          // Not worth haggling over — ring it up at the sticker price outright.
          if (ticket.price < NO_HAGGLE_BELOW_PRICE) completeCheckout(ticket.id, ticket.price);
          else bus.emit('open-haggle', ticket.id);
        } else {
          bus.emit('open-counter');
        }
      } else {
        bus.emit('open-shelf', target.id);
      }
    }
  }

  private tickCustomerSpawns(delta: number) {
    this.customerSpawnTimer += delta;
    if (this.customerSpawnTimer < this.nextSpawnAt) return;
    this.customerSpawnTimer = 0;

    const fast = gameState.shopUpgrades.marketingSign || gameState.isFestivalDay;
    const [baseMin, baseMax] = fast ? [1800, 3200] : [3500, 6500];
    // A better reputation means more foot traffic, on top of the sign/festival boost.
    const repMultiplier = gameState.reputationTier.spawnMultiplier;
    this.nextSpawnAt = Phaser.Math.Between(Math.round(baseMin / repMultiplier), Math.round(baseMax / repMultiplier));

    const maxConcurrent = gameState.isFestivalDay ? 5 : 3;
    const activeCustomers = this.children.list.filter((c) => (c as any).__customer).length;
    const stockedShelves = this.shelfVisuals.filter((v) => gameState.shelves.find((s) => s.id === v.id)?.card);
    if (activeCustomers >= maxConcurrent || stockedShelves.length === 0) return;

    spawnCustomer(
      this,
      stockedShelves.map((v) => ({ id: v.id, x: v.x, y: v.y })),
    );
  }
}
