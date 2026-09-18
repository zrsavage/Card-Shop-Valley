import Phaser from 'phaser';
import { gameState, bus } from '../game/state';
import { NPCS } from '../game/npcs';
import {
  TOWN_SHOP_DOOR_POS,
  TOWN_SHOP_DOOR_TRIGGER,
  TOWN_HALL_POS,
  FOUNTAIN_POS,
  FOUNTAIN_RADIUS,
  TOWN_TO_WILDS_TRIGGER,
  TOWN_FROM_WILDS_POS,
  MERCHANT_CART_POS,
  TOWN_DISTRIBUTOR_TRIGGER,
  TOWN_DISTRIBUTOR_DOOR_POS,
  TOWN_GENERAL_STORE_TRIGGER,
  TOWN_GENERAL_STORE_DOOR_POS,
} from '../game/layout';
import type { Season } from '../game/types';
import { humanoidTextureKey, playerTextureKey, attachCircleBody } from '../game/pixelArt';
import { grassTextureKey, woodTextureKey, drawTownHall, drawBackgroundHouse, drawFountain, type FountainVisual } from '../game/sceneryArt';
import { playFootstep } from '../game/audio';

const INTERACT_RANGE = 70;
const STEP_INTERVAL_MS = 300;
const AMBIENT_VILLAGER_COUNT = 7;
const AMBIENT_VILLAGER_COLORS = [0xffb703, 0x8ecae6, 0xc77dff, 0x90be6d, 0xf9844a, 0x577590, 0xe76f51, 0xa8dadc];
const NPC_TRANSITION_MS = 2500;

const GROUND_TINTS: Record<Season, number> = {
  Spring: 0x8bc34a,
  Summer: 0x9ccc65,
  Fall: 0xc98a3f,
  Winter: 0xe8f1f5,
};

interface NpcVisual {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
}

/** A nameless, non-interactive extra — just there so the town reads as a
 * busy place with more than four residents in it. Wanders forever between
 * random points, bumping gently off buildings and the player like anyone
 * else would rather than phasing through them. */
interface AmbientVillager {
  sprite: Phaser.GameObjects.Sprite;
  wanderTarget: { x: number; y: number };
  speed: number;
}

export default class TownScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private promptText!: Phaser.GameObjects.Text;
  private npcVisuals: NpcVisual[] = [];
  private npcsAreAfternoon = false;
  private villagers: AmbientVillager[] = [];
  private ground!: Phaser.GameObjects.TileSprite;
  private fountain!: FountainVisual;
  private merchantVisuals: Phaser.GameObjects.GameObject[] = [];
  private merchantLabel!: Phaser.GameObjects.Text;
  private stepTimer = 0;

  constructor() {
    super('Town');
  }

  create(data?: { from?: 'shop' | 'wilds' | 'distributor' | 'general-store' }) {
    this.cameras.main.setBackgroundColor('#2b2118');
    this.npcVisuals = [];
    this.stepTimer = 0;

    const grassKey = grassTextureKey(this, GROUND_TINTS[gameState.season]);
    this.ground = this.add.tileSprite(400, 300, 760, 560, grassKey).setDepth(0);

    // Worn dirt paths radiating out from the fountain to each of the four
    // destinations — so it's obvious at a glance that there's somewhere to
    // go in every direction, not just a wall of grass with a small label
    // way off at the edge.
    this.drawPathTo(TOWN_SHOP_DOOR_TRIGGER.x, TOWN_SHOP_DOOR_TRIGGER.y);
    this.drawPathTo(TOWN_TO_WILDS_TRIGGER.x, TOWN_TO_WILDS_TRIGGER.y);
    this.drawPathTo(TOWN_DISTRIBUTOR_TRIGGER.x, TOWN_DISTRIBUTOR_TRIGGER.y);
    this.drawPathTo(TOWN_GENERAL_STORE_TRIGGER.x, TOWN_GENERAL_STORE_TRIGGER.y);

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

    // Distributor's exterior door — on the top wall like the Shop's, but
    // well off to the right, clear of Town Hall's roof. An always-lit OPEN
    // sign hangs over it.
    this.add.rectangle(TOWN_DISTRIBUTOR_TRIGGER.x, 32, 110, 10, 0x4a3728).setDepth(1);
    this.add
      .text(TOWN_DISTRIBUTOR_TRIGGER.x, 48, 'DISTRIBUTOR ▲', { fontSize: '11px', color: '#fff8ec' })
      .setOrigin(0.5)
      .setDepth(1);
    this.add
      .text(TOWN_DISTRIBUTOR_TRIGGER.x, 66, 'OPEN', {
        fontSize: '11px',
        color: '#1b4332',
        backgroundColor: '#7ee787',
        padding: { x: 6, y: 2 },
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1);

    // General Store's exterior — bottom wall, well clear of the NPCs'
    // usual haunts and the Wilds gate.
    this.add.rectangle(TOWN_GENERAL_STORE_TRIGGER.x, 598, 100, 8, 0x4a3728).setDepth(1);
    this.add
      .text(TOWN_GENERAL_STORE_TRIGGER.x, 575, 'GENERAL STORE\n▼', { fontSize: '10px', color: '#a1887f', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1);

    // Fountain — stone rim, cracked and murky until repaired, then clear
    // water with a few gently pulsing sparkles.
    this.fountain = drawFountain(this, FOUNTAIN_POS.x, FOUNTAIN_POS.y, FOUNTAIN_RADIUS, gameState.townUpgrades.fountainRepaired);

    // Town hall — brick walls, a peaked roof, a door, and lit windows.
    const townHallObjs = drawTownHall(this, TOWN_HALL_POS.x, TOWN_HALL_POS.y, 130, 100);
    this.add
      .text(TOWN_HALL_POS.x, TOWN_HALL_POS.y + 4, 'TOWN\nHALL', { fontSize: '13px', color: '#fff5e1', align: 'center', backgroundColor: '#00000055', padding: { x: 4, y: 2 } })
      .setOrigin(0.5)
      .setDepth(4);
    void townHallObjs;
    const townHallBody = this.physics.add.staticBody(TOWN_HALL_POS.x - 65, TOWN_HALL_POS.y - 50, 130, 100);

    // Background houses — purely decorative (no door prompt, nothing to
    // buy), just filling in the empty corners so the town reads as a real
    // place with more than four buildings in it. Solid, not wallpaper —
    // walking into one stops you like Town Hall does.
    const BACKGROUND_HOUSES = [
      { x: 150, y: 130, w: 70, h: 55, wall: 0x9c7c5a, roof: 0x6a4c93 },
      { x: 580, y: 110, w: 60, h: 45, wall: 0x8d6e63, roof: 0xa15c2b },
      { x: 630, y: 520, w: 65, h: 50, wall: 0xa1887f, roof: 0x4a3728 },
    ];
    const backgroundHouseBodies: Phaser.Physics.Arcade.StaticBody[] = [];
    for (const house of BACKGROUND_HOUSES) {
      drawBackgroundHouse(this, house.x, house.y, house.w, house.h, house.wall, house.roof);
      backgroundHouseBodies.push(this.physics.add.staticBody(house.x - house.w / 2, house.y - house.h / 2, house.w, house.h));
    }

    // Traveling merchant's cart — only visible on the days it's actually in town.
    const cartWheelL = this.add.circle(MERCHANT_CART_POS.x - 24, MERCHANT_CART_POS.y + 16, 8, 0x2b1d0e).setDepth(3);
    const cartWheelR = this.add.circle(MERCHANT_CART_POS.x + 24, MERCHANT_CART_POS.y + 16, 8, 0x2b1d0e).setDepth(3);
    const cartWoodKey = woodTextureKey(this, 0x9c6644);
    const cartBody = this.add.tileSprite(MERCHANT_CART_POS.x, MERCHANT_CART_POS.y, 70, 40, cartWoodKey).setDepth(3);
    const cartOutline = this.add.rectangle(MERCHANT_CART_POS.x, MERCHANT_CART_POS.y, 70, 40, 0x000000, 0).setDepth(3).setStrokeStyle(3, 0x2b1d0e);
    const cartRoof = this.add.rectangle(MERCHANT_CART_POS.x, MERCHANT_CART_POS.y - 26, 84, 12, 0xc1440e).setDepth(3).setStrokeStyle(2, 0x7a1e0e);
    this.merchantLabel = this.add
      .text(MERCHANT_CART_POS.x, MERCHANT_CART_POS.y - 42, 'Merchant', { fontSize: '11px', color: '#fff8ec', backgroundColor: '#00000088', padding: { x: 4, y: 1 } })
      .setOrigin(0.5)
      .setDepth(4);
    this.merchantVisuals = [cartWheelL, cartWheelR, cartBody, cartOutline, cartRoof, this.merchantLabel];
    this.updateMerchantVisibility();

    // NPCs — start wherever the time of day actually puts them, not always
    // the morning spot, so arriving mid-afternoon doesn't show them
    // standing in the wrong place until the first tween kicks in.
    this.npcsAreAfternoon = gameState.energy / gameState.maxEnergy < 0.5;
    for (const npc of NPCS) {
      const npcTexture = humanoidTextureKey(this, npc.color, 28);
      const spot = this.npcsAreAfternoon ? npc.afternoonSpot : npc.morningSpot;
      const sprite = this.add.sprite(spot.x, spot.y, npcTexture).setDepth(4);
      const label = this.add
        .text(spot.x, spot.y - 24, npc.name, { fontSize: '11px', color: '#fff8ec', backgroundColor: '#00000088', padding: { x: 4, y: 1 } })
        .setOrigin(0.5)
        .setDepth(4);
      this.npcVisuals.push({ id: npc.id, sprite, label });
    }

    // Ambient villagers — nameless extras that just wander forever, so the
    // town reads as busy instead of four people standing still.
    this.villagers = [];
    for (let i = 0; i < AMBIENT_VILLAGER_COUNT; i++) {
      const color = AMBIENT_VILLAGER_COLORS[i % AMBIENT_VILLAGER_COLORS.length];
      const texture = humanoidTextureKey(this, color, 26);
      const x = Phaser.Math.Between(70, 730);
      const y = Phaser.Math.Between(70, 530);
      const sprite = this.add.sprite(x, y, texture).setDepth(3);
      this.physics.add.existing(sprite);
      attachCircleBody(sprite, 13);
      (sprite.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
      this.physics.add.collider(sprite, townHallBody);
      for (const houseBody of backgroundHouseBodies) this.physics.add.collider(sprite, houseBody);
      this.villagers.push({ sprite, wanderTarget: { x, y }, speed: Phaser.Math.Between(28, 48) });
    }

    // Player — arrives at the door leading back from wherever they came from.
    const spawnPos =
      data?.from === 'wilds'
        ? TOWN_FROM_WILDS_POS
        : data?.from === 'distributor'
          ? TOWN_DISTRIBUTOR_DOOR_POS
          : data?.from === 'general-store'
            ? TOWN_GENERAL_STORE_DOOR_POS
            : TOWN_SHOP_DOOR_POS;
    const playerTexture = playerTextureKey(this, gameState.equippedOutfitColor, 32);
    this.player = this.add.sprite(spawnPos.x, spawnPos.y, playerTexture).setDepth(5);
    this.physics.add.existing(this.player);
    attachCircleBody(this.player, 16);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.world.setBounds(30, 30, 740, 540);
    this.physics.add.collider(this.player, townHallBody);
    for (const houseBody of backgroundHouseBodies) this.physics.add.collider(this.player, houseBody);
    for (const villager of this.villagers) this.physics.add.collider(this.player, villager.sprite);

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

    bus.on('paused-changed', this.onPausedChanged, this);
    bus.on('town-upgrades-changed', this.onTownUpgradesChanged, this);
    bus.on('day-changed', this.onDayChanged, this);
    bus.on('enter-wilds', this.onEnterWilds, this);
    bus.on('merchant-changed', this.updateMerchantVisibility, this);
    bus.on('cosmetics-changed', this.onCosmeticsChanged, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('paused-changed', this.onPausedChanged, this);
      bus.off('town-upgrades-changed', this.onTownUpgradesChanged, this);
      bus.off('day-changed', this.onDayChanged, this);
      bus.off('enter-wilds', this.onEnterWilds, this);
      bus.off('merchant-changed', this.updateMerchantVisibility, this);
      bus.off('cosmetics-changed', this.onCosmeticsChanged, this);
    });
  }

  private onCosmeticsChanged() {
    this.player.setTexture(playerTextureKey(this, gameState.equippedOutfitColor, 32));
  }

  /** A straight dirt-path strip from the fountain out to a destination
   * door — drawn under the door markers/buildings (which are depth 1+)
   * but over the plain grass, so it reads as an actual road rather than a
   * decoration floating on top of everything. */
  private drawPathTo(toX: number, toY: number) {
    const fromX = FOUNTAIN_POS.x;
    const fromY = FOUNTAIN_POS.y;
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    const angle = Phaser.Math.Angle.Between(fromX, fromY, toX, toY);
    const path = this.add
      .rectangle((fromX + toX) / 2, (fromY + toY) / 2, dist, 30, 0xc9a876)
      .setDepth(0)
      .setStrokeStyle(2, 0x9c7c4f, 0.6);
    path.setRotation(angle);
  }

  private updateMerchantVisibility() {
    const active = gameState.merchantVisit?.day === gameState.day;
    for (const obj of this.merchantVisuals) (obj as Phaser.GameObjects.Rectangle).setVisible(active);
  }

  private onPausedChanged(paused: boolean) {
    if (paused) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      for (const v of this.villagers) (v.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
  }

  private onTownUpgradesChanged() {
    this.fountain.setRepaired(gameState.townUpgrades.fountainRepaired);
  }

  private onDayChanged() {
    this.ground.setTexture(grassTextureKey(this, GROUND_TINTS[gameState.season]));
    this.updateMerchantVisibility();
  }

  private onEnterWilds() {
    this.scene.start('Wilds');
  }

  /** No in-day clock anymore — energy spent stands in for how far into the
   * day it is (past the halfway point, NPCs move on to their afternoon
   * spot). Only fires the walk once, right on that transition, instead of
   * re-snapping every frame — they used to just teleport the instant this
   * ran; now they actually walk over. */
  private updateNpcPositions() {
    const isAfternoon = gameState.energy / gameState.maxEnergy < 0.5;
    if (isAfternoon === this.npcsAreAfternoon) return;
    this.npcsAreAfternoon = isAfternoon;
    for (const visual of this.npcVisuals) {
      const def = NPCS.find((n) => n.id === visual.id)!;
      const spot = isAfternoon ? def.afternoonSpot : def.morningSpot;
      this.tweens.add({
        targets: visual.sprite,
        x: spot.x,
        y: spot.y,
        duration: NPC_TRANSITION_MS,
        ease: 'Sine.inOut',
        onUpdate: () => visual.label.setPosition(visual.sprite.x, visual.sprite.y - 24),
      });
    }
  }

  private updateVillagers() {
    for (const v of this.villagers) {
      const body = v.sprite.body as Phaser.Physics.Arcade.Body;
      const d = Phaser.Math.Distance.Between(v.sprite.x, v.sprite.y, v.wanderTarget.x, v.wanderTarget.y);
      if (d < 12) {
        v.wanderTarget = { x: Phaser.Math.Between(70, 730), y: Phaser.Math.Between(70, 530) };
      }
      const angle = Phaser.Math.Angle.Between(v.sprite.x, v.sprite.y, v.wanderTarget.x, v.wanderTarget.y);
      body.setVelocity(Math.cos(angle) * v.speed, Math.sin(angle) * v.speed);
    }
  }

  update(_time: number, delta: number) {
    if (!gameState.paused) {
      const moving = this.handleMovement();
      this.tickFootsteps(moving, delta);
      this.handleInteract();
      this.handleDoorTrigger();
      this.handleDistributorTrigger();
      this.handleGeneralStoreTrigger();
      gameState.tickEnergy(delta);
      gameState.tickShopAutomation(delta);
      this.updateNpcPositions();
      this.updateVillagers();
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
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, TOWN_SHOP_DOOR_TRIGGER.x, TOWN_SHOP_DOOR_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Shop');
    }
  }

  private handleDistributorTrigger() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, TOWN_DISTRIBUTOR_TRIGGER.x, TOWN_DISTRIBUTOR_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Distributor');
    }
  }

  private handleGeneralStoreTrigger() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, TOWN_GENERAL_STORE_TRIGGER.x, TOWN_GENERAL_STORE_TRIGGER.y);
    if (d < 40) {
      this.scene.start('GeneralStore');
    }
  }

  private nearestInteractable(): { type: 'townhall' | 'npc' | 'wildsgate' | 'merchant' | 'fountain'; id?: string; x: number; y: number } | null {
    const merchantActive = gameState.merchantVisit?.day === gameState.day;
    const candidates: { type: 'townhall' | 'npc' | 'wildsgate' | 'merchant' | 'fountain'; id?: string; x: number; y: number }[] = [
      { type: 'townhall', x: TOWN_HALL_POS.x, y: TOWN_HALL_POS.y },
      { type: 'wildsgate', x: TOWN_TO_WILDS_TRIGGER.x, y: TOWN_TO_WILDS_TRIGGER.y },
      ...this.npcVisuals.map((v) => ({ type: 'npc' as const, id: v.id, x: v.sprite.x, y: v.sprite.y })),
      ...(merchantActive ? [{ type: 'merchant' as const, x: MERCHANT_CART_POS.x, y: MERCHANT_CART_POS.y }] : []),
      ...(gameState.townUpgrades.fountainRepaired ? [{ type: 'fountain' as const, x: FOUNTAIN_POS.x, y: FOUNTAIN_POS.y }] : []),
    ];
    let best: { type: 'townhall' | 'npc' | 'wildsgate' | 'merchant' | 'fountain'; id?: string; x: number; y: number } | null = null;
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
        target.type === 'townhall'
          ? 'Press E: Town Hall'
          : target.type === 'wildsgate'
            ? 'Press E: Wilds'
            : target.type === 'merchant'
              ? 'Press E: Merchant'
              : target.type === 'fountain'
                ? 'Press E: Fish'
                : `Press E: Talk`;
      this.promptText.setText(label).setPosition(target.x, target.y - 45).setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (!target) {
        bus.emit('open-menu');
      } else if (target.type === 'townhall') {
        bus.emit('open-townhall');
      } else if (target.type === 'wildsgate') {
        bus.emit('open-zonemap');
      } else if (target.type === 'merchant') {
        bus.emit('open-merchant');
      } else if (target.type === 'fountain') {
        bus.emit('open-fountain');
      } else {
        bus.emit('open-npc', target.id);
      }
    }
  }
}
