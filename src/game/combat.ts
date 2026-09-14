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
    maxHp: 60,
    damage: 14,
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
    maxHp: 110,
    damage: 20,
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
    maxHp: 150,
    damage: 26,
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
    maxHp: 260,
    damage: 34,
    speed: 40,
    aggroRange: 200,
    radius: 28,
    packDropChance: 0.4,
    packWeights: { starter: 0, deluxe: 15, mythic: 85 },
  },
];

/** Backward-compatible alias — the Bramble Wilds' own enemy roster. */
export const ENEMY_DEFS: EnemyDef[] = BRAMBLE_ENEMIES;

export interface ZoneDef {
  id: string;
  name: string;
  description: string;
  /** Gold cost to unlock; 0 for the always-available starting zone. */
  unlockCost: number;
  enemies: EnemyDef[];
  maxEnemies: number;
  spawnIntervalRange: [number, number];
  /** Visual identity so each zone reads as a different place, not just a
   * recolored enemy roster on the same ground. */
  cameraBg: string;
  groundColor: number;
  decorationColor: number;
}

export const ZONE_DEFS: ZoneDef[] = [
  {
    id: 'bramble',
    name: 'Bramble Wilds',
    description: 'The wilds just past town. Easy pickings, mostly Starter and Deluxe packs.',
    unlockCost: 0,
    enemies: BRAMBLE_ENEMIES,
    maxEnemies: 6,
    spawnIntervalRange: [2500, 5000],
    cameraBg: '#243318',
    groundColor: 0x3a5230,
    decorationColor: 0x2f4526,
  },
  {
    id: 'hollow',
    name: 'Deep Hollow',
    description: 'Tougher foes further out, with more enemies at once and better pack odds.',
    unlockCost: 500,
    enemies: HOLLOW_ENEMIES,
    maxEnemies: 8,
    spawnIntervalRange: [1800, 3800],
    cameraBg: '#161f16',
    groundColor: 0x2d3b2a,
    decorationColor: 0x1a241a,
  },
  {
    id: 'frostback',
    name: 'Frostback Reaches',
    description: 'The hardest ground — dense, dangerous, and heavily favors Mythic packs.',
    unlockCost: 1500,
    enemies: FROSTBACK_ENEMIES,
    maxEnemies: 10,
    spawnIntervalRange: [1500, 3000],
    cameraBg: '#14212a',
    groundColor: 0x9fc3cc,
    decorationColor: 0x6f96a0,
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
