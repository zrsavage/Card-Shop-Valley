import Phaser from 'phaser';

export function showFloatingText(scene: Phaser.Scene, x: number, y: number, text: string, color: string) {
  const t = scene.add
    .text(x, y, text, { fontSize: '14px', color, fontStyle: 'bold' })
    .setOrigin(0.5)
    .setDepth(20);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: 1100,
    ease: 'Cubic.Out',
    onComplete: () => t.destroy(),
  });
}
