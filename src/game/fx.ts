import Phaser from 'phaser';

export function showFloatingText(scene: Phaser.Scene, x: number, y: number, text: string, color: string, durationMs = 1100) {
  const t = scene.add
    .text(x, y, text, { fontSize: '14px', color, fontStyle: 'bold' })
    .setOrigin(0.5)
    .setDepth(20);
  // Hold in place before rising, so dialogue-length text has time to be
  // read rather than starting its fade the instant it appears.
  const holdMs = Math.min(900, durationMs * 0.4);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: durationMs - holdMs,
    delay: holdMs,
    ease: 'Cubic.Out',
    onComplete: () => t.destroy(),
  });
}

/** A speech-bubble-style variant for NPC/customer comments — longer-lived
 * and with a small background so a full sentence stays legible. */
export function showSpeechText(scene: Phaser.Scene, x: number, y: number, text: string, color: string) {
  const t = scene.add
    .text(x, y, text, {
      fontSize: '13px',
      color,
      fontStyle: 'bold',
      backgroundColor: '#fff8ecee',
      padding: { x: 6, y: 3 },
    })
    .setOrigin(0.5)
    .setDepth(20);
  scene.tweens.add({
    targets: t,
    y: y - 30,
    alpha: 0,
    duration: 900,
    delay: 1700,
    ease: 'Cubic.Out',
    onComplete: () => t.destroy(),
  });
}
