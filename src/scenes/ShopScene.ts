import Phaser from 'phaser';
import { gameState, bus } from '../game/state';
import { spawnCustomer } from '../game/Customer';
import { COUNTER_POS, SHOP_ENTRANCE_POS, SHOP_DOOR_TRIGGER, SHOP_SHELF_POSITIONS } from '../game/layout';
import type { ShelfPosition } from '../game/layout';
import { humanoidTextureKey, attachCircleBody } from '../game/pixelArt';

const INTERACT_RANGE = 70;
const PLAYER_SPEED = 190;

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

  constructor() {
    super('Shop');
  }

  create() {
    this.cameras.main.setBackgroundColor('#3e2723');
    this.shelfVisuals = [];
    this.customerSpawnTimer = 0;
    this.nextSpawnAt = 2000;

    // Floor
    this.add.rectangle(400, 300, 760, 560, 0xe8d5b7).setDepth(0);
    // Door gap (walk down through here to reach the town)
    this.add.rectangle(SHOP_DOOR_TRIGGER.x, 598, 100, 8, 0x4a3728).setDepth(1);
    this.add
      .text(SHOP_DOOR_TRIGGER.x, 575, 'TOWN ▼', { fontSize: '11px', color: '#a1887f' })
      .setOrigin(0.5)
      .setDepth(1);

    // Counter
    this.add.rectangle(COUNTER_POS.x, COUNTER_POS.y, 180, 60, 0x6f4e37).setDepth(2);
    this.add.rectangle(COUNTER_POS.x, COUNTER_POS.y - 22, 180, 14, 0xd9a066).setDepth(2);
    this.add
      .text(COUNTER_POS.x, COUNTER_POS.y, 'PACK\nCOUNTER', { fontSize: '14px', color: '#fff5e1', align: 'center' })
      .setOrigin(0.5)
      .setDepth(3);
    const counterBody = this.physics.add.staticBody(COUNTER_POS.x - 90, COUNTER_POS.y - 30, 180, 60);

    // Shelves — base six always present; upgrade-unlocked ones appear as they're purchased.
    const shelfBodies: Phaser.Physics.Arcade.StaticBody[] = [];
    SHOP_SHELF_POSITIONS.forEach((pos, i) => {
      if (this.isShelfUnlocked(pos)) {
        shelfBodies.push(this.createShelfVisual(pos, i));
      }
    });

    // Player
    const playerTexture = humanoidTextureKey(this, 0xffb703, 32);
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
    bus.on('shelves-changed', this.refreshShelfVisuals, this);
    bus.on('shop-upgrades-changed', this.onUpgradesChanged, this);
    bus.on('paused-changed', this.onPausedChanged, this);
    bus.on('day-summary', this.onDaySummary, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('shelves-changed', this.refreshShelfVisuals, this);
      bus.off('shop-upgrades-changed', this.onUpgradesChanged, this);
      bus.off('paused-changed', this.onPausedChanged, this);
      bus.off('day-summary', this.onDaySummary, this);
    });
  }

  private isShelfUnlocked(pos: ShelfPosition): boolean {
    if (pos.requires === null) return true;
    if (pos.requires === 'tier1') return gameState.shopUpgrades.extraShelvesTier1;
    return gameState.shopUpgrades.extraShelvesTier2;
  }

  private createShelfVisual(pos: ShelfPosition, index: number): Phaser.Physics.Arcade.StaticBody {
    const id = `shelf-${index}`;
    const base = this.add.rectangle(pos.x, pos.y, 90, 70, 0x8d6e63).setDepth(2);
    base.setStrokeStyle(3, 0x5d4037);
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
      this.handleMovement();
      this.handleInteract();
      this.handleDoorTrigger();
      gameState.tickEnergy(delta);
      this.tickCustomerSpawns(delta);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private handleMovement() {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown || this.wasd.left.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.wasd.right.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.wasd.up.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.wasd.down.isDown) vy += 1;
    const vec = new Phaser.Math.Vector2(vx, vy);
    if (vec.length() > 0) vec.normalize();
    body.setVelocity(vec.x * PLAYER_SPEED, vec.y * PLAYER_SPEED);
  }

  private handleDoorTrigger() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, SHOP_DOOR_TRIGGER.x, SHOP_DOOR_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Town', { from: 'shop' });
    }
  }

  private nearestInteractable(): { type: 'counter' | 'shelf'; id?: string; x: number; y: number } | null {
    const candidates: { type: 'counter' | 'shelf'; id?: string; x: number; y: number }[] = [
      { type: 'counter', x: COUNTER_POS.x, y: COUNTER_POS.y },
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
      const label = target.type === 'counter' ? 'Press E: Shop Counter' : 'Press E: Manage Shelf';
      this.promptText.setText(label).setPosition(target.x, target.y - 55).setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && target) {
      if (target.type === 'counter') {
        bus.emit('open-counter');
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
    const [min, max] = fast ? [1800, 3200] : [3500, 6500];
    this.nextSpawnAt = Phaser.Math.Between(min, max);

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
