import Phaser from 'phaser';
import { gameState, bus, DAY_LENGTH_MS } from '../game/state';
import { NPCS } from '../game/npcs';
import {
  TOWN_SHOP_DOOR_POS,
  TOWN_SHOP_DOOR_TRIGGER,
  TOWN_HALL_POS,
  FOUNTAIN_POS,
  FOUNTAIN_RADIUS,
  TOWN_TO_WILDS_TRIGGER,
  TOWN_FROM_WILDS_POS,
} from '../game/layout';
import type { Season } from '../game/types';

const INTERACT_RANGE = 70;
const PLAYER_SPEED = 190;

const GROUND_TINTS: Record<Season, number> = {
  Spring: 0x8bc34a,
  Summer: 0x9ccc65,
  Fall: 0xc98a3f,
  Winter: 0xe8f1f5,
};

interface NpcVisual {
  id: string;
  sprite: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

export default class TownScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Arc;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private promptText!: Phaser.GameObjects.Text;
  private npcVisuals: NpcVisual[] = [];
  private ground!: Phaser.GameObjects.Rectangle;
  private fountain!: Phaser.GameObjects.Arc;

  constructor() {
    super('Town');
  }

  create(data?: { from?: 'shop' | 'wilds' }) {
    this.cameras.main.setBackgroundColor('#2b2118');
    this.npcVisuals = [];

    this.ground = this.add.rectangle(400, 300, 760, 560, GROUND_TINTS[gameState.season]).setDepth(0);

    // Shop door (top wall)
    this.add.rectangle(TOWN_SHOP_DOOR_TRIGGER.x, 32, 110, 10, 0x4a3728).setDepth(1);
    this.add
      .text(TOWN_SHOP_DOOR_TRIGGER.x, 48, 'SHOP ▲', { fontSize: '11px', color: '#fff8ec' })
      .setOrigin(0.5)
      .setDepth(1);

    // Wilds path (left wall)
    this.add.rectangle(28, TOWN_TO_WILDS_TRIGGER.y, 10, 110, 0x4a3728).setDepth(1);
    this.add
      .text(52, TOWN_TO_WILDS_TRIGGER.y, 'WILDS\n◄', { fontSize: '11px', color: '#fff8ec', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1);

    // Fountain
    this.add.circle(FOUNTAIN_POS.x, FOUNTAIN_POS.y, FOUNTAIN_RADIUS + 8, 0x6d4c41).setDepth(1);
    this.fountain = this.add
      .circle(FOUNTAIN_POS.x, FOUNTAIN_POS.y, FOUNTAIN_RADIUS, gameState.townUpgrades.fountainRepaired ? 0x4fc3f7 : 0x8d9a9a)
      .setDepth(2);

    // Town hall
    this.add.rectangle(TOWN_HALL_POS.x, TOWN_HALL_POS.y, 130, 100, 0x5d4037).setDepth(2).setStrokeStyle(3, 0x3e2723);
    this.add.rectangle(TOWN_HALL_POS.x, TOWN_HALL_POS.y - 42, 130, 16, 0xd9a066).setDepth(2);
    this.add
      .text(TOWN_HALL_POS.x, TOWN_HALL_POS.y, 'TOWN\nHALL', { fontSize: '14px', color: '#fff5e1', align: 'center' })
      .setOrigin(0.5)
      .setDepth(3);
    const townHallBody = this.physics.add.staticBody(TOWN_HALL_POS.x - 65, TOWN_HALL_POS.y - 50, 130, 100);

    // NPCs
    for (const npc of NPCS) {
      const sprite = this.add.circle(npc.morningSpot.x, npc.morningSpot.y, 14, npc.color).setDepth(4).setStrokeStyle(2, 0x2b1d0e);
      const label = this.add
        .text(npc.morningSpot.x, npc.morningSpot.y - 24, npc.name, { fontSize: '11px', color: '#fff8ec', backgroundColor: '#00000088', padding: { x: 4, y: 1 } })
        .setOrigin(0.5)
        .setDepth(4);
      this.npcVisuals.push({ id: npc.id, sprite, label });
    }

    // Player — arrives at the door leading back from wherever they came from.
    const spawnPos = data?.from === 'wilds' ? TOWN_FROM_WILDS_POS : TOWN_SHOP_DOOR_POS;
    this.player = this.add.circle(spawnPos.x, spawnPos.y, 16, 0xffb703).setDepth(5).setStrokeStyle(3, 0x8a5a00);
    this.physics.add.existing(this.player);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCircle(16);
    playerBody.setCollideWorldBounds(true);
    this.physics.world.setBounds(30, 30, 740, 540);
    this.physics.add.collider(this.player, townHallBody);

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

    this.updateNpcPositions();

    bus.on('paused-changed', this.onPausedChanged, this);
    bus.on('town-upgrades-changed', this.onTownUpgradesChanged, this);
    bus.on('day-changed', this.onDayChanged, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('paused-changed', this.onPausedChanged, this);
      bus.off('town-upgrades-changed', this.onTownUpgradesChanged, this);
      bus.off('day-changed', this.onDayChanged, this);
    });
  }

  private onPausedChanged(paused: boolean) {
    if (paused) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  private onTownUpgradesChanged() {
    this.fountain.setFillStyle(gameState.townUpgrades.fountainRepaired ? 0x4fc3f7 : 0x8d9a9a);
  }

  private onDayChanged() {
    this.ground.setFillStyle(GROUND_TINTS[gameState.season]);
  }

  private updateNpcPositions() {
    const isAfternoon = gameState.dayTimeRemaining / DAY_LENGTH_MS < 0.5;
    for (const visual of this.npcVisuals) {
      const def = NPCS.find((n) => n.id === visual.id)!;
      const spot = isAfternoon ? def.afternoonSpot : def.morningSpot;
      visual.sprite.setPosition(spot.x, spot.y);
      visual.label.setPosition(spot.x, spot.y - 24);
    }
  }

  update(_time: number, delta: number) {
    if (!gameState.paused) {
      this.handleMovement();
      this.handleInteract();
      this.handleDoorTrigger();
      this.handleWildsTrigger();
      gameState.tickDay(delta);
      this.updateNpcPositions();
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
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, TOWN_SHOP_DOOR_TRIGGER.x, TOWN_SHOP_DOOR_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Shop');
    }
  }

  private handleWildsTrigger() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, TOWN_TO_WILDS_TRIGGER.x, TOWN_TO_WILDS_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Wilds');
    }
  }

  private nearestInteractable(): { type: 'townhall' | 'npc'; id?: string; x: number; y: number } | null {
    const candidates: { type: 'townhall' | 'npc'; id?: string; x: number; y: number }[] = [
      { type: 'townhall', x: TOWN_HALL_POS.x, y: TOWN_HALL_POS.y },
      ...this.npcVisuals.map((v) => ({ type: 'npc' as const, id: v.id, x: v.sprite.x, y: v.sprite.y })),
    ];
    let best: { type: 'townhall' | 'npc'; id?: string; x: number; y: number } | null = null;
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
      const label = target.type === 'townhall' ? 'Press E: Town Hall' : `Press E: Talk`;
      this.promptText.setText(label).setPosition(target.x, target.y - 45).setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && target) {
      if (target.type === 'townhall') {
        bus.emit('open-townhall');
      } else {
        bus.emit('open-npc', target.id);
      }
    }
  }
}
