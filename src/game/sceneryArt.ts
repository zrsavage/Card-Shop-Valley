import Phaser from 'phaser';

// Procedurally-textured scenery — the same "generated, not authored"
// approach as pixelArt.ts and cardArt.ts, but for the environment: tileable
// wood/grain/brick/stone patterns drawn once per texture key and reused,
// so the shop floor, counter, shelves, town hall, and fountain read as
// actual materials instead of single flat-colored rectangles.

function makeTexture(scene: Phaser.Scene, key: string, size: number, draw: (g: Phaser.GameObjects.Graphics) => void): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, size, size);
  g.destroy();
  return key;
}

function shade(color: number, percent: number): number {
  const c = Phaser.Display.Color.ValueToColor(color);
  return (percent >= 0 ? c.lighten(percent) : c.darken(-percent)).color;
}

/** A warm wood-plank tile — used for the shop floor, counter, and shelves
 * (a darker tone for furniture than for the floor beneath it). */
export function woodTextureKey(scene: Phaser.Scene, baseColor: number): string {
  const key = `tex-wood-${baseColor.toString(16)}`;
  const size = 64;
  return makeTexture(scene, key, size, (g) => {
    g.fillStyle(baseColor, 1);
    g.fillRect(0, 0, size, size);
    const seam = shade(baseColor, -18);
    g.lineStyle(1, seam, 0.6);
    g.lineBetween(0, 0, size, 0);
    g.lineBetween(0, size / 2, size, size / 2);
    // staggered plank ends, brick-style, so it doesn't read as a grid
    g.lineBetween(size / 2, 0, size / 2, size / 2);
    g.lineBetween(0, size / 2, 0, size);
    g.lineBetween(size * 0.62, size / 2, size * 0.62, size);
    // grain flecks
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      g.fillStyle(Math.random() < 0.5 ? shade(baseColor, -14) : shade(baseColor, 16), 0.3);
      g.fillRect(x, y, 5 + Math.random() * 5, 1.5);
    }
  });
}

/** A grassy ground tile, tinted per season/zone — blade tufts and a couple
 * of dirt patches instead of one solid color. */
export function grassTextureKey(scene: Phaser.Scene, baseColor: number): string {
  const key = `tex-grass-${baseColor.toString(16)}`;
  const size = 48;
  return makeTexture(scene, key, size, (g) => {
    g.fillStyle(baseColor, 1);
    g.fillRect(0, 0, size, size);
    const darker = shade(baseColor, -16);
    const lighter = shade(baseColor, 12);
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      g.fillStyle(Math.random() < 0.5 ? darker : lighter, 0.45);
      g.fillRect(x, y, 2, 4 + Math.random() * 3);
    }
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      g.fillStyle(darker, 0.22);
      g.fillCircle(x, y, 3 + Math.random() * 2);
    }
  });
}

/** A rocky/stone ground tile — used for the harsher Wilds zones (Hollow,
 * Frostback) instead of the softer grass tufts. */
export function stoneGroundTextureKey(scene: Phaser.Scene, baseColor: number): string {
  const key = `tex-stone-${baseColor.toString(16)}`;
  const size = 48;
  return makeTexture(scene, key, size, (g) => {
    g.fillStyle(baseColor, 1);
    g.fillRect(0, 0, size, size);
    const darker = shade(baseColor, -20);
    const lighter = shade(baseColor, 14);
    for (let i = 0; i < 10; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      g.fillStyle(Math.random() < 0.5 ? darker : lighter, 0.35);
      g.fillCircle(x, y, 2 + Math.random() * 4);
    }
    g.lineStyle(1, darker, 0.3);
    for (let i = 0; i < 3; i++) {
      const y = Math.random() * size;
      g.lineBetween(0, y, size, y + (Math.random() * 10 - 5));
    }
  });
}

/** A brick wall tile — used for the Town Hall's walls. */
export function brickTextureKey(scene: Phaser.Scene, baseColor = 0x8d5a4a): string {
  const key = `tex-brick-${baseColor.toString(16)}`;
  const size = 32;
  return makeTexture(scene, key, size, (g) => {
    g.fillStyle(baseColor, 1);
    g.fillRect(0, 0, size, size);
    const mortar = shade(baseColor, -30);
    g.lineStyle(1, mortar, 0.7);
    g.lineBetween(0, 0, size, 0);
    g.lineBetween(0, size / 2, size, size / 2);
    g.lineBetween(size / 2, 0, size / 2, size / 2);
    g.lineBetween(0, size / 2, 0, size);
    g.lineBetween(size, size / 2, size, size);
  });
}

/** Draws a proper little building for the Town Hall — brick walls, a
 * peaked roof, a door, and two lit windows — in place of a single flat
 * rectangle. Returns every object created so the caller can dispose of
 * them if the scene is torn down early (Phaser normally handles this on
 * scene shutdown, but the list is handy for bounds/labeling). */
export function drawTownHall(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const brickKey = brickTextureKey(scene);
  const wall = scene.add.tileSprite(x, y, w, h, brickKey).setDepth(2);
  objs.push(wall);

  // Triangle geometry must be given in 0-based local coordinates (0..width,
  // 0..height) for Phaser's default 0.5/0.5 origin to center it the way
  // Rectangle/TileSprite do — symmetric negative/positive points around 0
  // end up shifted by half the shape's size instead of centered.
  const roofHeight = 30;
  const roofWidth = w + 20;
  const roof = scene.add
    .triangle(x, y - h / 2 - roofHeight / 2, 0, roofHeight, roofWidth, roofHeight, roofWidth / 2, 0, 0x7a2e2e)
    .setDepth(2)
    .setStrokeStyle(2, 0x2b1d0e);
  objs.push(roof);

  const door = scene.add.rectangle(x, y + h / 2 - 18, 30, 36, 0x3e2723).setDepth(3).setStrokeStyle(2, 0x2b1d0e);
  objs.push(door);
  const doorknob = scene.add.circle(x + 10, y + h / 2 - 18, 2, 0xffd166).setDepth(3);
  objs.push(doorknob);

  const win1 = scene.add.rectangle(x - w / 4, y - 8, 18, 18, 0xbfe6ff, 0.9).setDepth(3).setStrokeStyle(2, 0x2b1d0e);
  const win2 = scene.add.rectangle(x + w / 4, y - 8, 18, 18, 0xbfe6ff, 0.9).setDepth(3).setStrokeStyle(2, 0x2b1d0e);
  objs.push(win1, win2);

  return objs;
}

export interface FountainVisual {
  rim: Phaser.GameObjects.Arc;
  water: Phaser.GameObjects.Arc;
  sparkles: Phaser.GameObjects.Arc[];
  cracks: Phaser.GameObjects.Graphics;
  setRepaired(repaired: boolean): void;
}

/** Draws a stone-rimmed fountain: a textured outer rim, an inner basin
 * that reads as murky and cracked until repaired, then clear water with a
 * few gently pulsing sparkles once it is. */
export function drawFountain(scene: Phaser.Scene, x: number, y: number, radius: number, repaired: boolean): FountainVisual {
  const rimOuter = scene.add.circle(x, y, radius + 10, 0x8d8d8d).setDepth(1).setStrokeStyle(3, 0x5d5d5d);
  const rim = scene.add.circle(x, y, radius + 4, 0xa8a8a8).setDepth(1).setStrokeStyle(2, 0x6d6d6d);
  const water = scene.add.circle(x, y, radius, repaired ? 0x4fc3f7 : 0x8d9a9a).setDepth(2);
  // Concentric ripple rings read as "water" better than a flat disc.
  const ripple1 = scene.add.circle(x, y, radius * 0.65, 0xffffff, 0).setDepth(2).setStrokeStyle(1, 0xffffff, 0.35);
  const ripple2 = scene.add.circle(x, y, radius * 0.35, 0xffffff, 0).setDepth(2).setStrokeStyle(1, 0xffffff, 0.25);

  const cracks = scene.add.graphics().setDepth(3).setVisible(!repaired);
  cracks.lineStyle(1.5, 0x4a4a4a, 0.6);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    const x2 = x + Math.cos(angle) * radius * 0.8;
    const y2 = y + Math.sin(angle) * radius * 0.8;
    cracks.lineBetween(x, y, x2, y2);
  }

  const sparkles: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * radius * 0.7;
    const sparkle = scene.add
      .circle(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, 2, 0xffffff, 0.9)
      .setDepth(4)
      .setVisible(repaired);
    scene.tweens.add({
      targets: sparkle,
      alpha: 0.2,
      duration: 700 + Math.random() * 500,
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 500,
    });
    sparkles.push(sparkle);
  }

  function setRepaired(nowRepaired: boolean) {
    water.setFillStyle(nowRepaired ? 0x4fc3f7 : 0x8d9a9a);
    cracks.setVisible(!nowRepaired);
    sparkles.forEach((s) => s.setVisible(nowRepaired));
  }

  void rimOuter;
  void ripple1;
  void ripple2;
  return { rim, water, sparkles, cracks, setRepaired };
}
