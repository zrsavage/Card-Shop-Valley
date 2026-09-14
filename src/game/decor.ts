export type DecorKind = 'rug' | 'plant' | 'banner' | 'lantern' | 'trophyCase';

export interface DecorDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  kind: DecorKind;
  /** Fixed placement in the shop — corners and the open center floor, all
   * clear of the shelf grid regardless of which shelf-count upgrades are
   * owned, so a decoration never ends up overlapping a shelf that gets
   * unlocked later. */
  x: number;
  y: number;
  color: number;
}

export const DECOR_ITEMS: DecorDef[] = [
  { id: 'rug', name: 'Cozy Rug', description: 'Warms up the shop floor.', cost: 150, kind: 'rug', x: 400, y: 300, color: 0xc1440e },
  { id: 'potted-plant', name: 'Potted Plant', description: 'A touch of green by the door.', cost: 100, kind: 'plant', x: 70, y: 70, color: 0x2d6a4f },
  { id: 'wall-banner', name: 'Wall Banner', description: 'Announces the shop is open for business.', cost: 200, kind: 'banner', x: 730, y: 70, color: 0x9c6644 },
  { id: 'lantern', name: 'Hanging Lantern', description: 'A warm glow in the corner.', cost: 120, kind: 'lantern', x: 70, y: 530, color: 0xffd166 },
  { id: 'trophy-case', name: 'Trophy Case', description: 'Show off just how far the shop has come.', cost: 350, kind: 'trophyCase', x: 730, y: 530, color: 0xffd700 },
];
