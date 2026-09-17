import Phaser from 'phaser';

// Procedurally-generated pixel-art sprites — placeholders for townsfolk/
// player/monsters until real art replaces them. Same idea as cardArt.ts:
// deterministic, no external assets, easy to swap out later (just point
// the relevant add.sprite call at a different texture). Grids are roughly
// double the old resolution (hair, eyes, shirt, split legs, shoes on the
// humanoid; horns, eyes, a belly patch, and teeth on the monster) so they
// read as small characters instead of colored blobs.

type Grid = string[];

const OUTLINE = 0x2b1d0e;
const SKIN = 0xf4c99b;
const EYE = 0x1a1108;
const HAIR = 0x4a3728;
const PANTS = 0x5d4037;
const SHOES = 0x3e2723;
const TEETH = 0xfff8ec;

// 12x16 chibi humanoid — used for the player, NPCs, and shop customers.
const HUMANOID: Grid = [
  '.OOOOOOOOOO.',
  '.OHHHHHHHHO.',
  'OHHSSSSSSHHO',
  'OHSSESSESSHO',
  'OHSSSSSSSSHO',
  '.OSSSSSSSSO.',
  '...OOSSOO...',
  '.OOBBBBBBOO.',
  'ObBBBBBBBBbO',
  'ObBBBBBBBBbO',
  'ObBBBBBBBBbO',
  'ObBBBBBBBBbO',
  'OPPPPPPPPPPO',
  '.OPPP..PPPO.',
  '.OPPP..PPPO.',
  '.OFFF..FFFO.',
];

// 14x17 chibi with a wide-brimmed hat — the player specifically, so a
// glance at the sprite (not just its color) tells them apart from every
// plain-haired NPC and customer using the shared HUMANOID grid above.
const PLAYER: Grid = [
  '..OOOOOOOOOO..',
  '.OBBBBBBBBBBO.',
  'OBBBBBBBBBBBBO',
  '.OHHSSSSSSHHO.',
  '.OHSSESSESSHO.',
  '.OHSSSSSSSSHO.',
  '..OSSSSSSSSO..',
  '....OOSSOO....',
  '..OOBBBBBBOO..',
  '.ObBBBBBBBBbO.',
  '.ObBBBBBBBBbO.',
  '.ObBBBBBBBBbO.',
  '.ObBBBBBBBBbO.',
  '.OPPPPPPPPPPO.',
  '..OPPP..PPPO..',
  '..OPPP..PPPO..',
  '..OFFF..FFFO..',
];

// 12x12 round horned beast — used for Wilds enemies, with a lighter belly
// patch and a hint of bared teeth so it reads as a creature, not a disc.
const MONSTER: Grid = [
  '..O......O..',
  '.OBO....OBO.',
  'OBBBBBBBBBBO',
  'OBBEBBBBEBBO',
  'OBBBBBBBBBBO',
  'OBBBCCCCBBBO',
  'OBBBCCCCBBBO',
  'OBBBBTTBBBBO',
  'OBBBBBBBBBBO',
  '.OBBBBBBBBO.',
  '..OOB..BOO..',
  '..OO....OO..',
];

function colorFor(ch: string, bodyColor: number, bodyShade: number, bodyLight: number): number | null {
  switch (ch) {
    case 'O':
      return OUTLINE;
    case 'H':
      return HAIR;
    case 'S':
      return SKIN;
    case 'E':
      return EYE;
    case 'B':
      return bodyColor;
    case 'b':
      return bodyShade;
    case 'C':
      return bodyLight;
    case 'P':
      return PANTS;
    case 'F':
      return SHOES;
    case 'T':
      return TEETH;
    default:
      return null;
  }
}

function buildTexture(scene: Phaser.Scene, key: string, grid: Grid, bodyColor: number, pixelSize: number): string {
  if (scene.textures.exists(key)) return key;
  const bodyShade = Phaser.Display.Color.ValueToColor(bodyColor).darken(25).color;
  const bodyLight = Phaser.Display.Color.ValueToColor(bodyColor).lighten(25).color;
  const w = grid[0].length;
  const h = grid.length;
  const g = scene.add.graphics();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const color = colorFor(grid[y][x], bodyColor, bodyShade, bodyLight);
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

/** The player's own sprite — hat and shirt both pick up the equipped
 * outfit color, so buying a new outfit recolors more than just the torso. */
export function playerTextureKey(scene: Phaser.Scene, bodyColor: number, targetDiameter: number): string {
  const pixelSize = Math.max(2, Math.round(targetDiameter / PLAYER[0].length));
  const key = `px-player-${bodyColor.toString(16)}-${pixelSize}`;
  return buildTexture(scene, key, PLAYER, bodyColor, pixelSize);
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
