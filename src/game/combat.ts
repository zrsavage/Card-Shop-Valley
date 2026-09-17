export interface EnemyDef {
  id: string;
  name: string;
  color: number;
  maxHp: number;
  damage: number;
  speed: number;
  aggroRange: number;
  radius: number;
  /** Chance (0-1) this enemy drops a pack when defeated. */
  packDropChance: number;
  /** Weighted choice among pack ids for which tier drops. */
  packWeights: Record<string, number>;
}

const BRAMBLE_ENEMIES: EnemyDef[] = [
  {
    id: 'sprite',
    name: 'Wild Sprite',
    color: 0x9b5de5,
    maxHp: 20,
    damage: 5,
    speed: 70,
    aggroRange: 130,
    radius: 12,
    packDropChance: 0.35,
    packWeights: { starter: 80, deluxe: 20, mythic: 0 },
  },
  {
    id: 'brute',
    name: 'Bramble Brute',
    color: 0xc1440e,
    maxHp: 45,
    damage: 10,
    speed: 55,
    aggroRange: 150,
    radius: 16,
    packDropChance: 0.28,
    packWeights: { starter: 40, deluxe: 50, mythic: 10 },
  },
  {
    id: 'warden',
    name: 'Wilds Warden',
    color: 0x2b1d0e,
    maxHp: 80,
    damage: 16,
    speed: 45,
    aggroRange: 170,
    radius: 20,
    packDropChance: 0.3,
    packWeights: { starter: 15, deluxe: 45, mythic: 40 },
  },
];

const HOLLOW_ENEMIES: EnemyDef[] = [
  {
    id: 'stalker',
    name: 'Hollow Stalker',
    color: 0x2d6a4f,
    maxHp: 90,
    damage: 22,
    speed: 80,
    aggroRange: 150,
    radius: 14,
    packDropChance: 0.4,
    packWeights: { starter: 30, deluxe: 55, mythic: 15 },
  },
  {
    id: 'ravager',
    name: 'Bog Ravager',
    color: 0x40514e,
    maxHp: 170,
    damage: 30,
    speed: 50,
    aggroRange: 180,
    radius: 22,
    packDropChance: 0.35,
    packWeights: { starter: 10, deluxe: 50, mythic: 40 },
  },
];

const FROSTBACK_ENEMIES: EnemyDef[] = [
  {
    id: 'frostwarden',
    name: 'Frost Warden',
    color: 0x4fc3f7,
    maxHp: 220,
    damage: 36,
    speed: 60,
    aggroRange: 190,
    radius: 22,
    packDropChance: 0.45,
    packWeights: { starter: 0, deluxe: 40, mythic: 60 },
  },
  {
    id: 'colossus',
    name: 'Rime Colossus',
    color: 0xcaf0f8,
    maxHp: 380,
    damage: 48,
    speed: 40,
    aggroRange: 200,
    radius: 28,
    packDropChance: 0.4,
    packWeights: { starter: 0, deluxe: 15, mythic: 85 },
  },
];

/** Backward-compatible alias — the Bramble Wilds' own enemy roster. */
export const ENEMY_DEFS: EnemyDef[] = BRAMBLE_ENEMIES;

export type BossSpecialAttack = 'rush' | 'aoeSlam';

export interface ZoneBossDef extends EnemyDef {
  /** Flat gold awarded on top of its (guaranteed) pack drop. */
  bonusGold: number;
  /** A signature move beyond "bigger and tankier" — a telegraphed charge
   * that punishes standing still, or a telegraphed slam that punishes
   * staying in melee range. */
  specialAttack: BossSpecialAttack;
}

/** How many regular kills in a single Wilds visit before the zone's boss
 * shows up — a build-up-and-payoff beat instead of just an endless grind. */
export const BOSS_KILL_THRESHOLD = 6;

/** Once a zone's boss has been killed this many times today, the zone is
 * "cleared out" — no more enemies spawn there until the next day. Caps how
 * much gold a single zone can be farmed for in one day. */
export const DAILY_BOSS_KILL_CAP = 2;

const ZONE_BOSSES: Record<string, ZoneBossDef> = {
  bramble: {
    id: 'bramble-boss',
    name: 'Elder Bramblehorn',
    color: 0x6a4c93,
    maxHp: 220,
    damage: 18,
    speed: 50,
    aggroRange: 220,
    radius: 30,
    packDropChance: 1,
    packWeights: { starter: 0, deluxe: 60, mythic: 40 },
    bonusGold: 100,
    specialAttack: 'rush',
  },
  hollow: {
    id: 'hollow-boss',
    name: 'The Bog Mother',
    color: 0x1b4332,
    maxHp: 450,
    damage: 34,
    speed: 45,
    aggroRange: 240,
    radius: 34,
    packDropChance: 1,
    packWeights: { starter: 0, deluxe: 30, mythic: 70 },
    bonusGold: 200,
    specialAttack: 'aoeSlam',
  },
  frostback: {
    id: 'frostback-boss',
    name: 'Glacial Sovereign',
    color: 0xa2d2ff,
    maxHp: 850,
    damage: 55,
    speed: 40,
    aggroRange: 260,
    radius: 40,
    packDropChance: 1,
    packWeights: { starter: 0, deluxe: 0, mythic: 100 },
    bonusGold: 400,
    specialAttack: 'aoeSlam',
  },
};

export interface ZoneDef {
  id: string;
  name: string;
  description: string;
  /** Gold cost to unlock; 0 for the always-available starting zone. */
  unlockCost: number;
  enemies: EnemyDef[];
  boss: ZoneBossDef;
  maxEnemies: number;
  spawnIntervalRange: [number, number];
  /** Visual identity so each zone reads as a different place, not just a
   * recolored enemy roster on the same ground. */
  cameraBg: string;
  groundColor: number;
  decorationColor: number;
  /** Attack/max HP a player should have before fighting here for real —
   * shown on the Wilds Map so a beating reads as "come back geared up",
   * not as the game being unfair. Purely advisory; nothing stops you from
   * walking in early and finding out the hard way. */
  recommendedAttack: number;
  recommendedHp: number;
}

export const ZONE_DEFS: ZoneDef[] = [
  {
    id: 'bramble',
    name: 'Bramble Wilds',
    description: 'The wilds just past town. Easy pickings, mostly Starter and Deluxe packs.',
    unlockCost: 0,
    enemies: BRAMBLE_ENEMIES,
    boss: ZONE_BOSSES.bramble,
    maxEnemies: 6,
    spawnIntervalRange: [2500, 5000],
    cameraBg: '#243318',
    groundColor: 0x3a5230,
    decorationColor: 0x2f4526,
    recommendedAttack: 14,
    recommendedHp: 100,
  },
  {
    id: 'hollow',
    name: 'Deep Hollow',
    description: 'Tougher foes further out, with more enemies at once and better pack odds. Come back once you\'ve upgraded — this ground will chew up a fresh start.',
    unlockCost: 500,
    enemies: HOLLOW_ENEMIES,
    boss: ZONE_BOSSES.hollow,
    maxEnemies: 8,
    spawnIntervalRange: [1800, 3800],
    cameraBg: '#161f16',
    groundColor: 0x2d3b2a,
    decorationColor: 0x1a241a,
    recommendedAttack: 26,
    recommendedHp: 180,
  },
  {
    id: 'frostback',
    name: 'Frostback Reaches',
    description: 'The hardest ground — dense, dangerous, and heavily favors Mythic packs. Not survivable without serious gear.',
    unlockCost: 1500,
    enemies: FROSTBACK_ENEMIES,
    boss: ZONE_BOSSES.frostback,
    maxEnemies: 10,
    spawnIntervalRange: [1500, 3000],
    cameraBg: '#14212a',
    groundColor: 0x9fc3cc,
    decorationColor: 0x6f96a0,
    recommendedAttack: 40,
    recommendedHp: 280,
  },
];

/** Returns a pack id if a drop occurs, otherwise null. */
export function rollPackDrop(def: EnemyDef): string | null {
  if (Math.random() > def.packDropChance) return null;
  const entries = Object.entries(def.packWeights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [id, weight] of entries) {
    if (roll < weight) return id;
    roll -= weight;
  }
  return null;
}
