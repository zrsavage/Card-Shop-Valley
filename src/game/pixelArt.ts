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

// A 3-frame walk cycle (idle, left-leg-lifted, right-leg-lifted), cycled
// idle-left-idle-right by tickWalkFrame below — the classic top-down RPG
// gait. Each "lift" frame is derived from the base grid by recoloring just
// its calf/foot rows (the lifted leg's calf takes the foot's color and its
// foot disappears), so every frame stays the exact same canvas size and
// swapping textures mid-walk never shifts or resizes the sprite.
export type WalkFrame = 0 | 1 | 2;

function withLegLift(grid: Grid, calfRow: number, footRow: number, leg: 'left' | 'right'): Grid {
  const calf = grid[calfRow].split('');
  const foot = grid[footRow].split('');
  const legRanges: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < foot.length; i++) {
    if (foot[i] === 'F' && start < 0) start = i;
    if (foot[i] !== 'F' && start >= 0) {
      legRanges.push([start, i - 1]);
      start = -1;
    }
  }
  if (start >= 0) legRanges.push([start, foot.length - 1]);
  const [from, to] = leg === 'left' ? legRanges[0] : legRanges[1];
  for (let i = from; i <= to; i++) {
    calf[i] = 'F';
    foot[i] = '.';
  }
  const out = [...grid];
  out[calfRow] = calf.join('');
  out[footRow] = foot.join('');
  return out;
}

const HUMANOID_FRAMES: [Grid, Grid, Grid] = [HUMANOID, withLegLift(HUMANOID, 14, 15, 'left'), withLegLift(HUMANOID, 14, 15, 'right')];
const PLAYER_FRAMES: [Grid, Grid, Grid] = [PLAYER, withLegLift(PLAYER, 15, 16, 'left'), withLegLift(PLAYER, 15, 16, 'right')];

// idle -> left lift -> idle -> right lift -> repeat, so both feet visibly
// return to the ground between steps instead of the legs just swapping.
const WALK_CYCLE: WalkFrame[] = [0, 1, 0, 2];
const WALK_FRAME_INTERVAL_MS = 160;

export interface WalkAnimState {
  step: number;
  timer: number;
}

export function newWalkAnimState(): WalkAnimState {
  return { step: 0, timer: 0 };
}

/** Advances a sprite's walk-cycle step while `moving` is true, snapping
 * straight back to the idle frame the instant it isn't. Returns the frame
 * to display and whether it's different from last call, so the caller only
 * pays for a setTexture() when the frame actually changes. */
export function tickWalkFrame(state: WalkAnimState, moving: boolean, deltaMs: number): { frame: WalkFrame; changed: boolean } {
  if (!moving) {
    const changed = state.step !== 0;
    state.step = 0;
    state.timer = 0;
    return { frame: WALK_CYCLE[0], changed };
  }
  state.timer += deltaMs;
  if (state.timer >= WALK_FRAME_INTERVAL_MS) {
    state.timer -= WALK_FRAME_INTERVAL_MS;
    state.step = (state.step + 1) % WALK_CYCLE.length;
    return { frame: WALK_CYCLE[state.step], changed: true };
  }
  return { frame: WALK_CYCLE[state.step], changed: false };
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

/** targetDiameter roughly sizes the sprite — its physics circle is separate, see attachCircleBody.
 * frame picks the walk-cycle pose (0 idle, 1/2 mid-stride) — see tickWalkFrame. */
export function humanoidTextureKey(scene: Phaser.Scene, bodyColor: number, targetDiameter: number, frame: WalkFrame = 0): string {
  const pixelSize = Math.max(2, Math.round(targetDiameter / HUMANOID[0].length));
  const key = `px-humanoid-${bodyColor.toString(16)}-${pixelSize}-f${frame}`;
  return buildTexture(scene, key, HUMANOID_FRAMES[frame], bodyColor, pixelSize);
}

/** The player's own sprite — hat and shirt both pick up the equipped
 * outfit color, so buying a new outfit recolors more than just the torso. */
export function playerTextureKey(scene: Phaser.Scene, bodyColor: number, targetDiameter: number, frame: WalkFrame = 0): string {
  const pixelSize = Math.max(2, Math.round(targetDiameter / PLAYER[0].length));
  const key = `px-player-${bodyColor.toString(16)}-${pixelSize}-f${frame}`;
  return buildTexture(scene, key, PLAYER_FRAMES[frame], bodyColor, pixelSize);
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

type TextureKeyFn = (scene: Phaser.Scene, color: number, size: number, frame: WalkFrame) => string;

/** Drives the walk cycle for a sprite whose movement is polled every frame
 * (Arcade velocity — the player, or anything else with a per-frame update
 * loop) rather than driven by a tween. Call .update() once per frame with
 * the current moving state; it only touches the sprite's texture on the
 * frames where the pose actually changes. */
export class WalkAnimator {
  private state: WalkAnimState = newWalkAnimState();
  frame: WalkFrame = 0;

  update(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, moving: boolean, deltaMs: number, textureKeyFn: TextureKeyFn, color: number, size: number) {
    const result = tickWalkFrame(this.state, moving, deltaMs);
    this.frame = result.frame;
    if (result.changed) sprite.setTexture(textureKeyFn(scene, color, size, result.frame));
  }
}

/** Drives the walk cycle for a sprite whose movement is a tween instead of
 * a per-frame poll (ambient villagers wandering forever, an NPC's
 * once-in-a-while walk to their afternoon spot, a customer crossing the
 * shop floor) — starts cycling immediately and keeps going until the
 * returned stop function is called (or the sprite is destroyed), at which
 * point it snaps back to the idle frame. */
export function attachWalkAnimation(scene: Phaser.Scene, sprite: Phaser.GameObjects.Sprite, textureKeyFn: TextureKeyFn, color: number, size: number): () => void {
  const state = newWalkAnimState();
  const timer = scene.time.addEvent({
    delay: WALK_FRAME_INTERVAL_MS,
    loop: true,
    callback: () => {
      const { frame, changed } = tickWalkFrame(state, true, WALK_FRAME_INTERVAL_MS);
      if (changed) sprite.setTexture(textureKeyFn(scene, color, size, frame));
    },
  });
  sprite.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
  return () => {
    timer.remove();
    const { frame, changed } = tickWalkFrame(state, false, 0);
    if (changed && sprite.active) sprite.setTexture(textureKeyFn(scene, color, size, frame));
  };
}
