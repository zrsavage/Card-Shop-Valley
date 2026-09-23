import Phaser from 'phaser';
import { gameState, bus } from '../game/state';
import { DISTRIBUTOR_COUNTER_POS, DISTRIBUTOR_ENTRANCE_POS, DISTRIBUTOR_DOOR_TRIGGER } from '../game/layout';
import { playerTextureKey, attachCircleBody, WalkAnimator } from '../game/pixelArt';
import { woodTextureKey } from '../game/sceneryArt';
import { playFootstep } from '../game/audio';

const INTERACT_RANGE = 70;
const STEP_INTERVAL_MS = 300;

/** The distributor: where every purchase that used to happen at the
 * player's own shop counter now lives — packs, shop upgrades, and
 * provisions. Nothing bought here shows up the same day. */
export default class DistributorScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private promptText!: Phaser.GameObjects.Text;
  private stepTimer = 0;
  private walkAnim = new WalkAnimator();

  constructor() {
    super('Distributor');
  }

  create() {
    this.cameras.main.setBackgroundColor('#2e2a24');
    this.stepTimer = 0;

    const floorKey = woodTextureKey(this, 0xc7b299);
    this.add.tileSprite(400, 300, 760, 560, floorKey).setDepth(0);

    // Door gap (walk down through here to reach town)
    this.add.rectangle(DISTRIBUTOR_DOOR_TRIGGER.x, 598, 100, 8, 0x4a3728).setDepth(1);
    this.add.text(DISTRIBUTOR_DOOR_TRIGGER.x, 575, 'TOWN ▼', { fontSize: '11px', color: '#a1887f' }).setOrigin(0.5).setDepth(1);

    // Distributor counter — crates stacked behind it read as a wholesaler,
    // not the player's own storefront.
    const counterWoodKey = woodTextureKey(this, 0x5d4a3a);
    this.add.tileSprite(DISTRIBUTOR_COUNTER_POS.x, DISTRIBUTOR_COUNTER_POS.y, 180, 60, counterWoodKey).setDepth(2);
    this.add.rectangle(DISTRIBUTOR_COUNTER_POS.x, DISTRIBUTOR_COUNTER_POS.y, 180, 60, 0x000000, 0).setDepth(2).setStrokeStyle(3, 0x2b1d0e);
    for (const dx of [-60, 0, 60]) {
      this.add.rectangle(DISTRIBUTOR_COUNTER_POS.x + dx, DISTRIBUTOR_COUNTER_POS.y - 44, 26, 22, 0x8d6e63).setDepth(2).setStrokeStyle(2, 0x2b1d0e);
    }
    this.add
      .text(DISTRIBUTOR_COUNTER_POS.x, DISTRIBUTOR_COUNTER_POS.y, 'DISTRIBUTOR', { fontSize: '13px', color: '#fff5e1', align: 'center' })
      .setOrigin(0.5)
      .setDepth(3);
    const counterBody = this.physics.add.staticBody(DISTRIBUTOR_COUNTER_POS.x - 90, DISTRIBUTOR_COUNTER_POS.y - 30, 180, 60);

    // Player — arrives at the door leading back to town.
    const playerTexture = playerTextureKey(this, gameState.equippedOutfitColor, 32);
    this.player = this.add.sprite(DISTRIBUTOR_ENTRANCE_POS.x, DISTRIBUTOR_ENTRANCE_POS.y, playerTexture).setDepth(5);
    this.physics.add.existing(this.player);
    attachCircleBody(this.player, 16);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.world.setBounds(30, 30, 740, 540);
    this.physics.add.collider(this.player, counterBody);

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
    bus.on('cosmetics-changed', this.onCosmeticsChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('paused-changed', this.onPausedChanged, this);
      bus.off('cosmetics-changed', this.onCosmeticsChanged, this);
    });
  }

  private onCosmeticsChanged() {
    this.player.setTexture(playerTextureKey(this, gameState.equippedOutfitColor, 32, this.walkAnim.frame));
  }

  private onPausedChanged(paused: boolean) {
    if (paused) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  update(_time: number, delta: number) {
    if (gameState.paused) {
      this.promptText.setVisible(false);
      return;
    }
    const moving = this.handleMovement();
    this.walkAnim.update(this, this.player, moving, delta, playerTextureKey, gameState.equippedOutfitColor, 32);
    this.tickFootsteps(moving, delta);
    this.handleInteract();
    this.handleDoorTrigger();
    gameState.tickEnergy(delta);
    gameState.tickShopAutomation(delta);
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
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, DISTRIBUTOR_DOOR_TRIGGER.x, DISTRIBUTOR_DOOR_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Town', { from: 'distributor' });
    }
  }

  private handleInteract() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, DISTRIBUTOR_COUNTER_POS.x, DISTRIBUTOR_COUNTER_POS.y);
    const near = d < INTERACT_RANGE;
    this.promptText.setText('Press E: Distributor').setPosition(DISTRIBUTOR_COUNTER_POS.x, DISTRIBUTOR_COUNTER_POS.y - 55).setVisible(near);

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      if (near) bus.emit('open-distributor');
      else bus.emit('open-menu');
    }
  }
}
