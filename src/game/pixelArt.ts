import Phaser from 'phaser';

// Simple procedurally-generated pixel-art sprites — placeholders for
// townsfolk/player/monsters until real art replaces them. Same idea as
// cardArt.ts: deterministic, no external assets, easy to swap out later
// (just point the relevant add.sprite call at a different texture).

type Grid = string[];

const OUTLINE = 0x2b1d0e;
const SKIN = 0xf4c99b;
const EYE = 0x1a1108;

// 8x11 chibi humanoid — used for the player, NPCs, and shop customers.
const HUMANOID: Grid = [
  '..OOOO..',
  '.OSSSSO.',
  '.OSESES.',
  '.OSSSSO.',
  '..OOOO..',
  '.OOBBOO.',
  'OBBBBBBO',
  'OBBBBBBO',
  'OBBBBBBO',
  '.OB..BO.',
  '.OO..OO.',
];

// 9x9 round horned blob — used for Wilds enemies.
const MONSTER: Grid = [
  '..O...O..',
  '.OBOOOBO.',
  'OBBBBBBBO',
  'OBEBBBEBO',
  'OBBBBBBBO',
  'OBBBBBBBO',
  'OBBBBBBBO',
  '.OBBBBBO.',
  '..OOOOO..',
];

function colorFor(ch: string, bodyColor: number): number | null {
  switch (ch) {
    case 'O':
      return OUTLINE;
    case 'S':
      return SKIN;
    case 'E':
      return EYE;
    case 'B':
      return bodyColor;
    default:
      return null;
  }
}

function buildTexture(scene: Phaser.Scene, key: string, grid: Grid, bodyColor: number, pixelSize: number): string {
  if (scene.textures.exists(key)) return key;
  const w = grid[0].length;
  const h = grid.length;
  const g = scene.add.graphics();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = colorFor(grid[y][x], bodyColor);
      if (color === null) continue;
      g.fillStyle(color, 1);
      g.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }
  g.generateTexture(key, w * pixelSize, h * pixelSize);
  g.destroy();
  return key;
}

/** targetDiameter roughly sizes the sprite — its physics circle is separate, see attachCircleBody. */
export function humanoidTextureKey(scene: Phaser.Scene, bodyColor: number, targetDiameter: number): string {
  const pixelSize = Math.max(2, Math.round(targetDiameter / HUMANOID[0].length));
  const key = `px-humanoid-${bodyColor.toString(16)}-${pixelSize}`;
  return buildTexture(scene, key, HUMANOID, bodyColor, pixelSize);
}

export function monsterTextureKey(scene: Phaser.Scene, bodyColor: number, targetDiameter: number): string {
  const pixelSize = Math.max(2, Math.round(targetDiameter / MONSTER[0].length));
  const key = `px-monster-${bodyColor.toString(16)}-${pixelSize}`;
  return buildTexture(scene, key, MONSTER, bodyColor, pixelSize);
}

/** Centers an Arcade circle body of the given radius within a sprite whose
 * texture may be taller/wider than the desired hitbox (the pixel art has
 * headroom above the "feet" for a head/hair, unlike the plain circles it
 * replaces). */
export function attachCircleBody(sprite: Phaser.GameObjects.Sprite, radius: number) {
  const body = sprite.body as Phaser.Physics.Arcade.Body;
  body.setCircle(radius, sprite.width / 2 - radius, sprite.height / 2 - radius);
}
