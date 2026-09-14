import Phaser from 'phaser';
import { gameState, bus, WILDS_EXTRA_ENERGY_DRAIN_PER_SEC, EXHAUSTED_SPEED_MULTIPLIER, EXHAUSTED_DAMAGE_TAKEN_MULTIPLIER } from '../game/state';
import { showFloatingText } from '../game/fx';
import { ZONE_DEFS, rollPackDrop, type EnemyDef, type ZoneDef } from '../game/combat';
import { PACKS } from '../game/packs';
import { WILDS_FROM_TOWN_POS, WILDS_TO_TOWN_TRIGGER } from '../game/layout';
import { humanoidTextureKey, monsterTextureKey, attachCircleBody } from '../game/pixelArt';
import { playHit, playPlayerHurt } from '../game/audio';

const PLAYER_SPEED = 240;
const MELEE_RANGE = 85;
const ATTACK_COOLDOWN_MS = 400;
const CONTACT_DAMAGE_COOLDOWN_MS = 900;
const HP_REGEN_DELAY_MS = 3000;
const HP_REGEN_PER_SEC = 6;

interface EnemyInstance {
  def: EnemyDef;
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hp: number;
  lastContactTime: number;
  wanderTarget: { x: number; y: number };
}

export default class WildsScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private promptText!: Phaser.GameObjects.Text;
  private enemies: EnemyInstance[] = [];
  private attackCooldownRemaining = 0;
  private spawnTimer = 0;
  private nextSpawnAt = 1500;
  private lastDamageTime = 0;
  private zone!: ZoneDef;

  constructor() {
    super('Wilds');
  }

  create() {
    this.zone = ZONE_DEFS.find((z) => z.id === gameState.currentZoneId) ?? ZONE_DEFS[0];
    this.cameras.main.setBackgroundColor(this.zone.cameraBg);
    this.enemies = [];
    this.attackCooldownRemaining = 0;
    this.spawnTimer = 0;
    this.nextSpawnAt = 1500;
    this.lastDamageTime = 0;

    // Wild terrain — colored per zone so each one reads as a different
    // place, not just a recolored enemy roster on the same ground.
    this.add.rectangle(400, 300, 760, 560, this.zone.groundColor).setDepth(0);
    for (let i = 0; i < 14; i++) {
      const x = Phaser.Math.Between(50, 750);
      const y = Phaser.Math.Between(50, 550);
      this.add.circle(x, y, Phaser.Math.Between(10, 22), this.zone.decorationColor, 0.6).setDepth(0);
    }

    this.add
      .text(400, 56, this.zone.name, { fontSize: '13px', color: '#fff8ec', backgroundColor: '#000000aa', padding: { x: 8, y: 3 } })
      .setOrigin(0.5, 0)
      .setDepth(10);

    // Path back to town (left wall)
    this.add.rectangle(28, WILDS_TO_TOWN_TRIGGER.y, 10, 110, 0x4a3728).setDepth(1);
    this.add
      .text(52, WILDS_TO_TOWN_TRIGGER.y, 'TOWN\n◄', { fontSize: '11px', color: '#fff8ec', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1);

    gameState.healFully();

    const playerTexture = humanoidTextureKey(this, 0xffb703, 32);
    this.player = this.add.sprite(WILDS_FROM_TOWN_POS.x, WILDS_FROM_TOWN_POS.y, playerTexture).setDepth(5);
    this.physics.add.existing(this.player);
    attachCircleBody(this.player, 16);
    (this.player.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);
    this.physics.world.setBounds(30, 30, 740, 540);

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
    this.attackKey = this.input.keyboard!.addKey('SPACE');

    for (let i = 0; i < 3; i++) this.spawnEnemy();

    bus.on('paused-changed', this.onPausedChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('paused-changed', this.onPausedChanged, this);
    });
  }

  private onPausedChanged(paused: boolean) {
    if (paused) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  update(time: number, delta: number) {
    if (gameState.paused) {
      this.promptText.setVisible(false);
      return;
    }
    if (this.attackCooldownRemaining > 0) this.attackCooldownRemaining -= delta;

    this.handleMovement();
    this.handleAttack();
    this.handleReturnTrigger();
    this.updateEnemies(time, delta);
    this.tickSpawns(delta);
    this.tickRegen(time, delta);
    gameState.tickEnergy(delta, WILDS_EXTRA_ENERGY_DRAIN_PER_SEC);

    const nearReturn = Phaser.Math.Distance.Between(this.player.x, this.player.y, WILDS_TO_TOWN_TRIGGER.x, WILDS_TO_TOWN_TRIGGER.y) < 70;
    this.promptText.setVisible(nearReturn);
    if (nearReturn) {
      this.promptText.setText('Walk left to return to town').setPosition(this.player.x, this.player.y - 35);
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
    const speed = gameState.isExhausted ? PLAYER_SPEED * EXHAUSTED_SPEED_MULTIPLIER : PLAYER_SPEED;
    body.setVelocity(vec.x * speed, vec.y * speed);
  }

  private handleReturnTrigger() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, WILDS_TO_TOWN_TRIGGER.x, WILDS_TO_TOWN_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Town', { from: 'wilds' });
    }
  }

  private handleAttack() {
    if (this.attackCooldownRemaining > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.attackKey)) return;
    this.attackCooldownRemaining = ATTACK_COOLDOWN_MS;

    const ring = this.add.circle(this.player.x, this.player.y, 8, 0xfff3d6, 0.5).setDepth(6);
    this.tweens.add({
      targets: ring,
      radius: MELEE_RANGE,
      alpha: 0,
      duration: 200,
      onComplete: () => ring.destroy(),
    });

    for (const enemy of [...this.enemies]) {
      const d = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
      if (d < MELEE_RANGE) {
        this.damageEnemy(enemy, gameState.attackDamage);
      }
    }
  }

  private damageEnemy(enemy: EnemyInstance, amount: number) {
    enemy.hp -= amount;
    playHit();
    showFloatingText(this, enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 6, `-${amount}`, '#fff3d6');
    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
      return;
    }
    const frac = Math.max(0, enemy.hp / enemy.def.maxHp);
    enemy.hpBarFill.setSize(30 * frac, 5);
  }

  private killEnemy(enemy: EnemyInstance) {
    const packId = rollPackDrop(enemy.def);
    if (packId) {
      gameState.awardPack(packId);
      const pack = PACKS.find((p) => p.id === packId);
      showFloatingText(this, enemy.sprite.x, enemy.sprite.y - 24, `+1 ${pack?.name ?? 'Pack'}!`, '#ffd166');
    }
    enemy.sprite.destroy();
    enemy.hpBarBg.destroy();
    enemy.hpBarFill.destroy();
    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  private updateEnemies(time: number, delta: number) {
    const dt = delta / 1000;
    for (const enemy of this.enemies) {
      const distToPlayer = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);

      if (distToPlayer < enemy.def.aggroRange) {
        const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
        enemy.sprite.x += Math.cos(angle) * enemy.def.speed * dt;
        enemy.sprite.y += Math.sin(angle) * enemy.def.speed * dt;
      } else {
        const wanderDist = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, enemy.wanderTarget.x, enemy.wanderTarget.y);
        if (wanderDist < 10) {
          enemy.wanderTarget = {
            x: Phaser.Math.Clamp(enemy.sprite.x + Phaser.Math.Between(-80, 80), 50, 750),
            y: Phaser.Math.Clamp(enemy.sprite.y + Phaser.Math.Between(-80, 80), 50, 550),
          };
        }
        const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, enemy.wanderTarget.x, enemy.wanderTarget.y);
        enemy.sprite.x += Math.cos(angle) * (enemy.def.speed * 0.4) * dt;
        enemy.sprite.y += Math.sin(angle) * (enemy.def.speed * 0.4) * dt;
      }

      enemy.hpBarBg.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 10);
      enemy.hpBarFill.setPosition(enemy.sprite.x - 15, enemy.sprite.y - enemy.def.radius - 10);

      const contactDist = enemy.def.radius + 16 + 2;
      if (distToPlayer < contactDist && time - enemy.lastContactTime > CONTACT_DAMAGE_COOLDOWN_MS) {
        enemy.lastContactTime = time;
        this.lastDamageTime = time;
        const damage = gameState.isExhausted ? Math.round(enemy.def.damage * EXHAUSTED_DAMAGE_TAKEN_MULTIPLIER) : enemy.def.damage;
        const dead = gameState.takeDamage(damage);
        playPlayerHurt();
        showFloatingText(this, this.player.x, this.player.y - 24, `-${damage}`, '#ff6b6b');
        if (dead) {
          this.handlePlayerDown();
          return;
        }
      }
    }
  }

  private handlePlayerDown() {
    gameState.healFully();
    showFloatingText(this, this.player.x, this.player.y - 24, `Knocked out!`, '#ff6b6b');
    this.scene.start('Town', { from: 'wilds' });
  }

  private tickRegen(time: number, delta: number) {
    if (time - this.lastDamageTime < HP_REGEN_DELAY_MS) return;
    gameState.regenHp((HP_REGEN_PER_SEC * delta) / 1000);
  }

  private tickSpawns(delta: number) {
    this.spawnTimer += delta;
    if (this.spawnTimer < this.nextSpawnAt) return;
    this.spawnTimer = 0;
    const [min, max] = this.zone.spawnIntervalRange;
    this.nextSpawnAt = Phaser.Math.Between(min, max);
    if (this.enemies.length >= this.zone.maxEnemies) return;
    this.spawnEnemy();
  }

  private spawnEnemy() {
    const def = Phaser.Utils.Array.GetRandom(this.zone.enemies);
    let x = 400;
    let y = 300;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = Phaser.Math.Between(70, 730);
      y = Phaser.Math.Between(70, 530);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 160) break;
    }

    const texture = monsterTextureKey(this, def.color, def.radius * 2);
    const sprite = this.add.sprite(x, y, texture).setDepth(4);
    const hpBarBg = this.add.rectangle(x, y - def.radius - 10, 30, 5, 0x2b1d0e).setDepth(6);
    const hpBarFill = this.add.rectangle(x - 15, y - def.radius - 10, 30, 5, 0xff6b6b).setOrigin(0, 0.5).setDepth(7);
    hpBarBg.setOrigin(0.5, 0.5);

    this.enemies.push({
      def,
      sprite,
      hpBarBg,
      hpBarFill,
      hp: def.maxHp,
      lastContactTime: 0,
      wanderTarget: { x, y },
    });
  }
}
