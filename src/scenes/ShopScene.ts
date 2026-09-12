import Phaser from 'phaser';
import { gameState, bus } from '../game/state';
import { spawnCustomer } from '../game/Customer';
import { COUNTER_POS, ENTRANCE_POS, SHELF_POSITIONS } from '../game/layout';

const INTERACT_RANGE = 70;
const PLAYER_SPEED = 190;

interface ShelfVisual {
  id: string;
  x: number;
  y: number;
  base: Phaser.GameObjects.Rectangle;
  cardIcon: Phaser.GameObjects.Arc;
  priceTag: Phaser.GameObjects.Text;
  emptyLabel: Phaser.GameObjects.Text;
}

export default class ShopScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc;
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

    // Floor
    this.add.rectangle(400, 300, 760, 560, 0xe8d5b7).setDepth(0);
    // Door gap
    this.add.rectangle(ENTRANCE_POS.x, 598, 100, 8, 0x4a3728).setDepth(1);

    // Counter
    this.add.rectangle(COUNTER_POS.x, COUNTER_POS.y, 180, 60, 0x6f4e37).setDepth(2);
    this.add.rectangle(COUNTER_POS.x, COUNTER_POS.y - 22, 180, 14, 0xd9a066).setDepth(2);
    this.add
      .text(COUNTER_POS.x, COUNTER_POS.y, 'PACK\nCOUNTER', { fontSize: '14px', color: '#fff5e1', align: 'center' })
      .setOrigin(0.5)
      .setDepth(3);
    const counterBody = this.physics.add.staticBody(COUNTER_POS.x - 90, COUNTER_POS.y - 30, 180, 60);

    // Shelves
    const shelfBodies: Phaser.Physics.Arcade.StaticBody[] = [];
    SHELF_POSITIONS.forEach((pos, i) => {
      const id = `shelf-${i}`;
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
      this.shelfVisuals.push({ id, x: pos.x, y: pos.y, base, cardIcon, priceTag, emptyLabel });
      shelfBodies.push(this.physics.add.staticBody(pos.x - 45, pos.y - 35, 90, 70));
    });

    // Player
    this.player = this.add.circle(400, 480, 16, 0xffb703).setDepth(5).setStrokeStyle(3, 0x8a5a00);
    this.physics.add.existing(this.player);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCircle(16);
    playerBody.setCollideWorldBounds(true);
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
    bus.on('paused-changed', (paused: boolean) => {
      if (paused) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    });

    bus.on('day-summary', () => {
      // clear any lingering customers on the floor
      this.children.list
        .filter((c) => (c as any).__customer)
        .forEach((c) => (c as any).destroy?.());
    });
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
      this.tickDay(delta);
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
      const label = target.type === 'counter' ? 'Press E: Buy Packs' : 'Press E: Manage Shelf';
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

  private tickDay(delta: number) {
    gameState.dayTimeRemaining -= delta;
    bus.emit('time-changed', Math.max(0, gameState.dayTimeRemaining));
    if (gameState.dayTimeRemaining <= 0) {
      gameState.endDay();
    }
  }

  private tickCustomerSpawns(delta: number) {
    this.customerSpawnTimer += delta;
    if (this.customerSpawnTimer < this.nextSpawnAt) return;
    this.customerSpawnTimer = 0;
    this.nextSpawnAt = Phaser.Math.Between(3500, 6500);

    const activeCustomers = this.children.list.filter((c) => (c as any).__customer).length;
    const stockedShelves = this.shelfVisuals.filter(
      (v) => gameState.shelves.find((s) => s.id === v.id)?.card,
    );
    if (activeCustomers >= 3 || stockedShelves.length === 0) return;

    const target = Phaser.Utils.Array.GetRandom(stockedShelves);
    spawnCustomer(this, target.id, target.x, target.y);
  }
}
