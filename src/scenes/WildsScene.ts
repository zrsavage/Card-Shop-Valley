import Phaser from 'phaser';
import {
  gameState,
  bus,
  WILDS_EXTRA_ENERGY_DRAIN_PER_SEC,
  EXHAUSTED_DAMAGE_TAKEN_MULTIPLIER,
  RANGED_COOLDOWN_MS,
  RANGED_PROJECTILE_SPEED,
  RANGED_MAX_TRAVEL,
} from '../game/state';
import { showFloatingText, showBannerText } from '../game/fx';
import { ZONE_DEFS, rollPackDrop, BOSS_KILL_THRESHOLD, type EnemyDef, type ZoneDef, type BossSpecialAttack } from '../game/combat';
import { PACKS } from '../game/packs';
import { WILDS_FROM_TOWN_POS, WILDS_TO_TOWN_TRIGGER } from '../game/layout';
import { playerTextureKey, monsterTextureKey, attachCircleBody, WalkAnimator } from '../game/pixelArt';
import { grassTextureKey, stoneGroundTextureKey } from '../game/sceneryArt';
import { playHit, playPlayerHurt, playLegendary, playFootstep } from '../game/audio';

const STEP_INTERVAL_MS = 300;
const ATTACK_COOLDOWN_MS = 400;
const CONTACT_DAMAGE_COOLDOWN_MS = 900;
const HP_REGEN_DELAY_MS = 3000;
// Was 6/sec — full HP back in under 20s made getting hit almost meaningless.
// A real fight should be able to outpace this on its own.
const HP_REGEN_PER_SEC = 2;

// Boss special attacks.
const SPECIAL_COOLDOWN_MS = 6000;
const SPECIAL_INITIAL_DELAY_MS = 2500;
const RUSH_TELEGRAPH_MS = 500;
const RUSH_DURATION_MS = 700;
const RUSH_SPEED_MULTIPLIER = 3.2;
const RUSH_DAMAGE_MULTIPLIER = 1.4;
const AOE_TELEGRAPH_MS = 650;
const AOE_RADIUS = 130;
const AOE_DAMAGE_MULTIPLIER = 1.6;
const ZONE_CLEARED_NOTICE_MS = 3200;

interface ProjectileInstance {
  sprite: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  traveled: number;
  damage: number;
  geared: boolean;
}

interface EnemyInstance {
  def: EnemyDef;
  sprite: Phaser.GameObjects.Sprite;
  hpBarBg: Phaser.GameObjects.Rectangle;
  hpBarFill: Phaser.GameObjects.Rectangle;
  hp: number;
  lastContactTime: number;
  wanderTarget: { x: number; y: number };
  isBoss: boolean;
  bonusGold: number;
  nameLabel: Phaser.GameObjects.Text | null;
  specialAttack: BossSpecialAttack | null;
  nextSpecialAt: number;
  rushUntil: number;
  rushDirX: number;
  rushDirY: number;
}

export default class WildsScene extends Phaser.Scene {
  player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private rangedKey!: Phaser.Input.Keyboard.Key;
  private menuKey!: Phaser.Input.Keyboard.Key;
  private promptText!: Phaser.GameObjects.Text;
  private enemies: EnemyInstance[] = [];
  private projectiles: ProjectileInstance[] = [];
  private attackCooldownRemaining = 0;
  /** >0 means rooted, mid-windup on the ranged weapon; fires and resets to
   * 0 once it counts down. */
  private rangedWindupRemaining = 0;
  private rangedCooldownRemaining = 0;
  private spawnTimer = 0;
  private nextSpawnAt = 1500;
  private lastDamageTime = 0;
  private zone!: ZoneDef;
  private killCount = 0;
  private bossSpawned = false;
  private stepTimer = 0;
  private walkAnim = new WalkAnimator();
  /** Radians; drives the directional melee cone. Kept from the last frame
   * with movement input, so standing still still swings the way you faced. */
  private facingAngle = -Math.PI / 2;
  /** True once this zone has hit its daily boss-kill cap — no more spawns
   * until the day ends. */
  private zoneCleared = false;

  constructor() {
    super('Wilds');
  }

  create() {
    this.zone = ZONE_DEFS.find((z) => z.id === gameState.currentZoneId) ?? ZONE_DEFS[0];
    this.cameras.main.setBackgroundColor(this.zone.cameraBg);
    this.enemies = [];
    this.projectiles = [];
    this.attackCooldownRemaining = 0;
    this.rangedWindupRemaining = 0;
    this.rangedCooldownRemaining = 0;
    this.spawnTimer = 0;
    this.nextSpawnAt = 1500;
    this.lastDamageTime = 0;
    this.killCount = 0;
    this.bossSpawned = false;
    this.stepTimer = 0;
    this.facingAngle = -Math.PI / 2;
    this.zoneCleared = gameState.isZoneClearedToday(this.zone.id);

    // Wild terrain — textured per zone so each one reads as a different
    // place, not just a recolored enemy roster on the same ground. Frostback
    // gets a rockier tile to match its icy, hostile description.
    const groundKey =
      this.zone.id === 'frostback' ? stoneGroundTextureKey(this, this.zone.groundColor) : grassTextureKey(this, this.zone.groundColor);
    this.add.tileSprite(400, 300, 760, 560, groundKey).setDepth(0);
    // Sparser and more spread out than the town's clutter — the Wilds
    // should read as empty, secluded ground, not another populated place.
    for (let i = 0; i < 8; i++) {
      const x = Phaser.Math.Between(50, 750);
      const y = Phaser.Math.Between(50, 550);
      this.add.circle(x, y, Phaser.Math.Between(8, 18), this.zone.decorationColor, 0.6).setDepth(0);
    }

    const zoneLabel = this.zoneCleared ? `${this.zone.name} (cleared for today)` : this.zone.name;
    this.add
      .text(400, 56, zoneLabel, { fontSize: '13px', color: '#fff8ec', backgroundColor: '#000000aa', padding: { x: 8, y: 3 } })
      .setOrigin(0.5, 0)
      .setDepth(10);

    // Path back to town (left wall)
    this.add.rectangle(28, WILDS_TO_TOWN_TRIGGER.y, 10, 110, 0x4a3728).setDepth(1);
    this.add
      .text(52, WILDS_TO_TOWN_TRIGGER.y, 'TOWN\n◄', { fontSize: '11px', color: '#fff8ec', align: 'center' })
      .setOrigin(0.5)
      .setDepth(1);

    gameState.healFully();

    const playerTexture = playerTextureKey(this, gameState.equippedOutfitColor, 32);
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
    this.rangedKey = this.input.keyboard!.addKey('R');
    this.menuKey = this.input.keyboard!.addKey('E');

    if (!this.zoneCleared) {
      for (let i = 0; i < 3; i++) this.spawnEnemy();
    }

    bus.on('paused-changed', this.onPausedChanged, this);
    bus.on('cosmetics-changed', this.onCosmeticsChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off('paused-changed', this.onPausedChanged, this);
      bus.off('cosmetics-changed', this.onCosmeticsChanged, this);
    });
  }

  private onPausedChanged(paused: boolean) {
    if (paused) (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  private onCosmeticsChanged() {
    this.player.setTexture(playerTextureKey(this, gameState.equippedOutfitColor, 32, this.walkAnim.frame));
  }

  update(time: number, delta: number) {
    if (gameState.paused) {
      this.promptText.setVisible(false);
      return;
    }
    if (this.attackCooldownRemaining > 0) this.attackCooldownRemaining -= delta;

    const moving = this.handleMovement();
    this.walkAnim.update(this, this.player, moving, delta, playerTextureKey, gameState.equippedOutfitColor, 32);
    this.tickFootsteps(moving, delta);
    this.handleAttack();
    this.tickRangedAttack(delta);
    this.updateProjectiles(delta);
    this.handleReturnTrigger();
    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) bus.emit('open-menu');
    this.updateEnemies(time, delta);
    this.tickSpawns(delta);
    this.tickRegen(time, delta);
    gameState.tickEnergy(delta, WILDS_EXTRA_ENERGY_DRAIN_PER_SEC);
    gameState.tickShopAutomation(delta);

    const nearReturn = Phaser.Math.Distance.Between(this.player.x, this.player.y, WILDS_TO_TOWN_TRIGGER.x, WILDS_TO_TOWN_TRIGGER.y) < 70;
    this.promptText.setVisible(nearReturn);
    if (nearReturn) {
      this.promptText.setText('Walk left to return to town').setPosition(this.player.x, this.player.y - 35);
    }
  }

  private handleMovement(): boolean {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.rangedWindupRemaining > 0) {
      // Rooted in place while the ranged shot charges — the tradeoff for
      // the extra damage once it actually fires.
      body.setVelocity(0, 0);
      return false;
    }
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown || this.wasd.left.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.wasd.right.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.wasd.up.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.wasd.down.isDown) vy += 1;
    const vec = new Phaser.Math.Vector2(vx, vy);
    const moving = vec.length() > 0;
    if (moving) {
      vec.normalize();
      this.facingAngle = Math.atan2(vec.y, vec.x);
    }
    // Exhaustion's speed penalty now lives in the moveSpeed getter itself
    // (applies in every scene, not just here) — don't double it up.
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

  private handleReturnTrigger() {
    const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, WILDS_TO_TOWN_TRIGGER.x, WILDS_TO_TOWN_TRIGGER.y);
    if (d < 40) {
      this.scene.start('Town', { from: 'wilds' });
    }
  }

  private handleAttack() {
    if (this.rangedWindupRemaining > 0) return;
    if (this.attackCooldownRemaining > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.attackKey)) return;
    this.attackCooldownRemaining = ATTACK_COOLDOWN_MS * gameState.attackCooldownMultiplier;

    // A directional cone in the last-faced direction, not a full-circle AoE —
    // the Attack Range upgrade makes it both longer (radius) and wider (arc).
    const range = gameState.meleeRange;
    const arcDeg = gameState.attackArcDegrees;
    const facingDeg = Phaser.Math.RadToDeg(this.facingAngle);
    const wedge = this.add.arc(this.player.x, this.player.y, 8, facingDeg - arcDeg / 2, facingDeg + arcDeg / 2, false, 0xfff3d6, 0.5).setDepth(6);
    this.tweens.add({
      targets: wedge,
      radius: range,
      alpha: 0,
      duration: 200,
      onComplete: () => wedge.destroy(),
    });

    // Under-geared for this zone: the swing still connects (cone/range are
    // unaffected) but lands for nothing, so it's obvious gear is the actual
    // blocker rather than the attack silently whiffing.
    const geared = gameState.attackDamage >= this.zone.recommendedAttack;
    const halfArcRad = Phaser.Math.DegToRad(arcDeg) / 2;

    for (const enemy of [...this.enemies]) {
      const d = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
      if (d >= range) continue;
      const angleToEnemy = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.sprite.x, enemy.sprite.y);
      const diff = Phaser.Math.Angle.Wrap(angleToEnemy - this.facingAngle);
      if (Math.abs(diff) > halfArcRad) continue;

      if (geared) {
        this.damageEnemy(enemy, gameState.attackDamage);
      } else {
        showFloatingText(this, enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 6, `No Damage!`, '#a1887f');
      }
    }
  }

  /** The General Store's alternate weapon: press R to root in place and
   * charge a shot, then fire it once the windup finishes. Slower and far
   * more committal than the melee swing, but hits much harder. */
  private tickRangedAttack(delta: number) {
    if (this.rangedCooldownRemaining > 0) this.rangedCooldownRemaining -= delta;

    if (this.rangedWindupRemaining > 0) {
      this.rangedWindupRemaining -= delta;
      if (this.rangedWindupRemaining <= 0) {
        this.rangedWindupRemaining = 0;
        this.fireProjectile();
      }
      return;
    }

    if (!gameState.combatUpgrades.rangedWeaponUnlocked) return;
    if (this.rangedCooldownRemaining > 0) return;
    if (!Phaser.Input.Keyboard.JustDown(this.rangedKey)) return;

    const windupMs = gameState.rangedWindupMs;
    this.rangedWindupRemaining = windupMs;
    this.rangedCooldownRemaining = windupMs + RANGED_COOLDOWN_MS;

    const charge = this.add.circle(this.player.x, this.player.y, 4, 0xffd166, 0.55).setDepth(6).setStrokeStyle(2, 0xff8500);
    this.tweens.add({ targets: charge, radius: 22, alpha: 0, duration: windupMs, onComplete: () => charge.destroy() });
    showFloatingText(this, this.player.x, this.player.y - 30, 'Aiming...', '#ffd166', windupMs);
  }

  private fireProjectile() {
    const vx = Math.cos(this.facingAngle) * RANGED_PROJECTILE_SPEED;
    const vy = Math.sin(this.facingAngle) * RANGED_PROJECTILE_SPEED;
    const sprite = this.add.circle(this.player.x, this.player.y, 6, 0xffd166).setStrokeStyle(2, 0x2b1d0e).setDepth(6);
    const geared = gameState.attackDamage >= this.zone.recommendedAttack;
    const damage = Math.round(gameState.attackDamage * gameState.rangedDamageMultiplier);
    this.projectiles.push({ sprite, vx, vy, traveled: 0, damage, geared });
    playHit();
  }

  private updateProjectiles(delta: number) {
    const dt = delta / 1000;
    for (const p of [...this.projectiles]) {
      const stepX = p.vx * dt;
      const stepY = p.vy * dt;
      p.sprite.x += stepX;
      p.sprite.y += stepY;
      p.traveled += Math.hypot(stepX, stepY);

      let hit = false;
      for (const enemy of this.enemies) {
        const d = Phaser.Math.Distance.Between(p.sprite.x, p.sprite.y, enemy.sprite.x, enemy.sprite.y);
        if (d < enemy.def.radius + 6) {
          if (p.geared) {
            this.damageEnemy(enemy, p.damage);
          } else {
            showFloatingText(this, enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 6, `No Damage!`, '#a1887f');
          }
          hit = true;
          break;
        }
      }

      const outOfBounds = p.sprite.x < 20 || p.sprite.x > 780 || p.sprite.y < 20 || p.sprite.y > 580;
      if (hit || p.traveled >= RANGED_MAX_TRAVEL || outOfBounds) {
        p.sprite.destroy();
        this.projectiles = this.projectiles.filter((x) => x !== p);
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
    const barWidth = enemy.isBoss ? 70 : 30;
    const frac = Math.max(0, enemy.hp / enemy.def.maxHp);
    enemy.hpBarFill.setSize(barWidth * frac, 5);
  }

  private killEnemy(enemy: EnemyInstance) {
    gameState.noteEnemyDefeated();
    const packId = rollPackDrop(enemy.def);
    if (packId) {
      gameState.awardPack(packId);
      const pack = PACKS.find((p) => p.id === packId);
      showFloatingText(this, enemy.sprite.x, enemy.sprite.y - 24, `+1 ${pack?.name ?? 'Pack'}!`, '#ffd166');
    }
    if (enemy.isBoss) {
      const goldAwarded = Math.round(enemy.bonusGold * gameState.bossGoldMultiplier);
      gameState.addGold(goldAwarded);
      playLegendary();
      showFloatingText(this, enemy.sprite.x, enemy.sprite.y - 48, `Boss defeated! +${goldAwarded}g`, '#ffd166', 1800);
      this.bossSpawned = false;
      this.killCount = 0;

      const nowCleared = gameState.noteBossDefeated(this.zone.id);
      if (nowCleared) {
        this.zoneCleared = true;
        showBannerText(this, `Looks like you've cleared out the area for today, try coming back tomorrow!`, ZONE_CLEARED_NOTICE_MS);
        this.time.delayedCall(ZONE_CLEARED_NOTICE_MS, () => {
          this.scene.start('Town', { from: 'wilds' });
        });
      }
    } else {
      this.killCount += 1;
    }
    enemy.sprite.destroy();
    enemy.hpBarBg.destroy();
    enemy.hpBarFill.destroy();
    enemy.nameLabel?.destroy();
    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  private updateEnemies(time: number, delta: number) {
    const dt = delta / 1000;
    for (const enemy of this.enemies) {
      const distToPlayer = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
      const isRushing = enemy.rushUntil > time;
      // While nextSpecialAt is parked at Infinity, the boss is mid-telegraph
      // (or mid-slam-resolve) — frozen in place except for an active rush dash.
      const isBusy = enemy.nextSpecialAt === Infinity;

      if (enemy.isBoss && enemy.specialAttack && !isBusy && !isRushing && time >= enemy.nextSpecialAt) {
        enemy.nextSpecialAt = Infinity;
        this.triggerBossSpecial(enemy);
      }

      if (isRushing) {
        enemy.sprite.x += enemy.rushDirX * enemy.def.speed * RUSH_SPEED_MULTIPLIER * dt;
        enemy.sprite.y += enemy.rushDirY * enemy.def.speed * RUSH_SPEED_MULTIPLIER * dt;
      } else if (isBusy) {
        // Planting for a telegraphed attack — hold position.
      } else if (distToPlayer < enemy.def.aggroRange) {
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

      const barWidth = enemy.isBoss ? 70 : 30;
      enemy.hpBarBg.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 10);
      enemy.hpBarFill.setPosition(enemy.sprite.x - barWidth / 2, enemy.sprite.y - enemy.def.radius - 10);
      enemy.nameLabel?.setPosition(enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 24);

      const contactDist = enemy.def.radius + 16 + 2;
      if (distToPlayer < contactDist && time - enemy.lastContactTime > CONTACT_DAMAGE_COOLDOWN_MS) {
        enemy.lastContactTime = time;
        this.lastDamageTime = time;
        const baseDamage = isRushing ? Math.round(enemy.def.damage * RUSH_DAMAGE_MULTIPLIER) : enemy.def.damage;
        const damage = gameState.isExhausted ? Math.round(baseDamage * EXHAUSTED_DAMAGE_TAKEN_MULTIPLIER) : baseDamage;
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

  /** Kicks off a boss's signature move: a telegraph window (so it's avoidable,
   * not a free hit) followed by the actual rush dash or AoE slam resolution. */
  private triggerBossSpecial(enemy: EnemyInstance) {
    if (enemy.specialAttack === 'rush') {
      showFloatingText(this, enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 30, 'Charging!', '#ff6b6b', RUSH_TELEGRAPH_MS);
      enemy.sprite.setTint(0xff4444);
      this.time.delayedCall(RUSH_TELEGRAPH_MS, () => {
        if (!this.enemies.includes(enemy)) return;
        enemy.sprite.clearTint();
        const angle = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
        enemy.rushDirX = Math.cos(angle);
        enemy.rushDirY = Math.sin(angle);
        enemy.rushUntil = this.time.now + RUSH_DURATION_MS;
        this.time.delayedCall(RUSH_DURATION_MS, () => {
          if (this.enemies.includes(enemy)) enemy.rushUntil = 0;
          enemy.nextSpecialAt = this.time.now + SPECIAL_COOLDOWN_MS;
        });
      });
    } else if (enemy.specialAttack === 'aoeSlam') {
      const indicator = this.add
        .circle(enemy.sprite.x, enemy.sprite.y, AOE_RADIUS, 0xff6b6b, 0.12)
        .setStrokeStyle(2, 0xff6b6b, 0.8)
        .setDepth(3);
      showFloatingText(this, enemy.sprite.x, enemy.sprite.y - enemy.def.radius - 30, 'Slam incoming!', '#ff6b6b', AOE_TELEGRAPH_MS);
      this.tweens.add({ targets: indicator, alpha: 0.35, duration: AOE_TELEGRAPH_MS });
      this.time.delayedCall(AOE_TELEGRAPH_MS, () => {
        indicator.destroy();
        if (!this.enemies.includes(enemy)) return;
        const d = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.player.x, this.player.y);
        if (d < AOE_RADIUS) {
          const baseDamage = Math.round(enemy.def.damage * AOE_DAMAGE_MULTIPLIER);
          const damage = gameState.isExhausted ? Math.round(baseDamage * EXHAUSTED_DAMAGE_TAKEN_MULTIPLIER) : baseDamage;
          const dead = gameState.takeDamage(damage);
          playPlayerHurt();
          showFloatingText(this, this.player.x, this.player.y - 24, `-${damage}`, '#ff6b6b');
          this.lastDamageTime = this.time.now;
          if (dead) this.handlePlayerDown();
        }
        enemy.nextSpecialAt = this.time.now + SPECIAL_COOLDOWN_MS;
      });
    }
  }

  private handlePlayerDown() {
    gameState.healFully();
    showFloatingText(this, this.player.x, this.player.y - 24, `Knocked out!`, '#ff6b6b');
    this.scene.start('Town', { from: 'wilds' });
  }

  private tickRegen(time: number, delta: number) {
    if (time - this.lastDamageTime < HP_REGEN_DELAY_MS) return;
    gameState.regenHp((HP_REGEN_PER_SEC * gameState.regenRateMultiplier * delta) / 1000);
  }

  private tickSpawns(delta: number) {
    if (this.zoneCleared) return;
    if (!this.bossSpawned && this.killCount >= BOSS_KILL_THRESHOLD) {
      this.spawnBoss();
    }

    this.spawnTimer += delta;
    if (this.spawnTimer < this.nextSpawnAt) return;
    this.spawnTimer = 0;
    const [min, max] = this.zone.spawnIntervalRange;
    this.nextSpawnAt = Phaser.Math.Between(min, max);
    if (this.enemies.length >= this.zone.maxEnemies) return;
    this.spawnEnemy();
  }

  private findSpawnSpot(): { x: number; y: number } {
    let x = 400;
    let y = 300;
    for (let attempt = 0; attempt < 10; attempt++) {
      x = Phaser.Math.Between(70, 730);
      y = Phaser.Math.Between(70, 530);
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 160) break;
    }
    return { x, y };
  }

  private spawnEnemy() {
    const def = Phaser.Utils.Array.GetRandom(this.zone.enemies);
    const { x, y } = this.findSpawnSpot();

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
      isBoss: false,
      bonusGold: 0,
      nameLabel: null,
      specialAttack: null,
      nextSpecialAt: 0,
      rushUntil: 0,
      rushDirX: 0,
      rushDirY: 0,
    });
  }

  /** A build-up-and-payoff beat: after enough regular kills in this visit,
   * the zone's boss shows up — bigger, tankier, and a guaranteed strong drop. */
  private spawnBoss() {
    this.bossSpawned = true;
    const def = this.zone.boss;
    const { x, y } = this.findSpawnSpot();

    showBannerText(this, `${def.name} appears!`, 1800);

    const texture = monsterTextureKey(this, def.color, def.radius * 2);
    const sprite = this.add.sprite(x, y, texture).setDepth(4);
    const nameLabel = this.add
      .text(x, y - def.radius - 24, def.name, { fontSize: '12px', color: '#ffd166', backgroundColor: '#000000aa', padding: { x: 5, y: 2 } })
      .setOrigin(0.5)
      .setDepth(6);
    const hpBarBg = this.add.rectangle(x, y - def.radius - 10, 70, 6, 0x2b1d0e).setDepth(6);
    const hpBarFill = this.add.rectangle(x - 35, y - def.radius - 10, 70, 6, 0xff6b6b).setOrigin(0, 0.5).setDepth(7);
    hpBarBg.setOrigin(0.5, 0.5);

    this.enemies.push({
      def,
      sprite,
      hpBarBg,
      hpBarFill,
      hp: def.maxHp,
      lastContactTime: 0,
      wanderTarget: { x, y },
      isBoss: true,
      bonusGold: def.bonusGold,
      nameLabel,
      specialAttack: def.specialAttack,
      nextSpecialAt: this.time.now + SPECIAL_INITIAL_DELAY_MS,
      rushUntil: 0,
      rushDirX: 0,
      rushDirY: 0,
    });
  }
}
