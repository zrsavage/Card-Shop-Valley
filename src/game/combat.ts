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

export const ENEMY_DEFS: EnemyDef[] = [
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
