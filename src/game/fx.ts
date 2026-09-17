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

/** A wide, boxed banner for a full-sentence announcement (zone cleared,
 * boss incoming) — word-wrapped and backed, unlike the small floating pops
 * used for damage/gold numbers, so a long message actually stays legible. */
export function showBannerText(scene: Phaser.Scene, text: string, durationMs = 2600) {
  const t = scene.add
    .text(400, 130, text, {
      fontSize: '16px',
      color: '#fff8ec',
      fontStyle: 'bold',
      align: 'center',
      backgroundColor: '#2b1d0edd',
      padding: { x: 14, y: 10 },
      wordWrap: { width: 560 },
    })
    .setOrigin(0.5)
    .setDepth(25);
  const holdMs = Math.max(0, durationMs - 500);
  scene.tweens.add({
    targets: t,
    alpha: 0,
    duration: durationMs - holdMs,
    delay: holdMs,
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
