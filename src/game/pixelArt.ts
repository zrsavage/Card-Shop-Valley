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

// A side-to-side walking waddle — instead of swapping to a different pose,
// the whole sprite tilts left, back to upright, then tilts right, repeat.
// At each extreme it visibly reads as leaning/turning into that direction
// rather than just bouncing a foot up and down. Since it's a rotation
// applied to the sprite itself (not baked into a texture), it costs nothing
// extra to generate and never disturbs the (rotation-invariant) circular
// hitbox underneath.
const WALK_TILT_CYCLE = [0, -1, 0, 1];
const WALK_TILT_DEGREES = 16;
const WALK_TILT_INTERVAL_MS = 160;

export interface WalkAnimState {
  step: number;
  timer: number;
}

export function newWalkAnimState(): WalkAnimState {
  return { step: 0, timer: 0 };
}

/** Advances a sprite's waddle step while `moving` is true, snapping
 * straight back upright the instant it isn't. Returns the angle (degrees)
 * to display and whether it's different from last call, so the caller only
 * pays for a setAngle() when the pose actually changes. */
export function tickWalkFrame(state: WalkAnimState, moving: boolean, deltaMs: number): { angle: number; changed: boolean } {
  if (!moving) {
    const changed = state.step !== 0;
    state.step = 0;
    state.timer = 0;
    return { angle: 0, changed };
  }
  state.timer += deltaMs;
  if (state.timer >= WALK_TILT_INTERVAL_MS) {
    state.timer -= WALK_TILT_INTERVAL_MS;
    state.step = (state.step + 1) % WALK_TILT_CYCLE.length;
    return { angle: WALK_TILT_CYCLE[state.step] * WALK_TILT_DEGREES, changed: true };
  }
  return { angle: WALK_TILT_CYCLE[state.step] * WALK_TILT_DEGREES, changed: false };
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

/** Drives the walking waddle for a sprite whose movement is polled every
 * frame (Arcade velocity — the player, or anything else with a per-frame
 * update loop) rather than driven by a tween. Call .update() once per frame
 * with the current moving state; it only touches the sprite's angle on the
 * frames where the tilt actually changes. */
export class WalkAnimator {
  private state: WalkAnimState = newWalkAnimState();
  angle = 0;

  update(sprite: Phaser.GameObjects.Sprite, moving: boolean, deltaMs: number) {
    const result = tickWalkFrame(this.state, moving, deltaMs);
    this.angle = result.angle;
    if (result.changed) sprite.setAngle(result.angle);
  }
}

/** Drives the walking waddle for a sprite whose movement is a tween instead
 * of a per-frame poll (ambient villagers wandering forever, an NPC's
 * once-in-a-while walk to their afternoon spot, a customer crossing the
 * shop floor) — starts tilting immediately and keeps going until the
 * returned stop function is called (or the sprite is destroyed), at which
 * point it snaps back upright. */
export function attachWalkAnimation(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite): () => void {
  const state = newWalkAnimState();
  const timer = scene.time.addEvent({
    delay: WALK_TILT_INTERVAL_MS,
    loop: true,
    callback: () => {
      const { angle, changed } = tickWalkFrame(state, true, WALK_TILT_INTERVAL_MS);
      if (changed) sprite.setAngle(angle);
    },
  });
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
  return () => {
    timer.remove();
    if (sprite.active) sprite.setAngle(0);
  };
}
