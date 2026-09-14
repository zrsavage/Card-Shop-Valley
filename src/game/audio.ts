// Small procedurally-generated sound effects via the Web Audio API — same
// "placeholder now, real assets later" approach as pixelArt.ts and
// cardArt.ts, so the game isn't completely silent while real SFX are TBD.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', gainPeak = 0.12, delay = 0) {
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ac.destination);
    const t0 = ac.currentTime + delay;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // Audio is a nice-to-have — never let it break gameplay.
  }
}

export function playCoin() {
  beep(880, 0.1, 'square', 0.07);
  beep(1320, 0.12, 'square', 0.06, 0.05);
}

export function playCardPop() {
  beep(520, 0.09, 'triangle', 0.09);
}

export function playPackOpen() {
  beep(220, 0.18, 'sawtooth', 0.05);
  beep(330, 0.18, 'sawtooth', 0.05, 0.05);
}

export function playLegendary() {
  [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.28, 'triangle', 0.11, i * 0.09));
}

export function playHit() {
  beep(140, 0.08, 'square', 0.1);
}

export function playPlayerHurt() {
  beep(180, 0.15, 'sawtooth', 0.09);
}

export function playChime() {
  beep(660, 0.1, 'sine', 0.08);
  beep(990, 0.14, 'sine', 0.06, 0.06);
}

export function playError() {
  beep(160, 0.14, 'sawtooth', 0.07);
}

// Quiet, low-pitched footfalls — a small random pitch wobble so a walking
// cadence doesn't sound like the exact same beep on a loop.
export function playFootstep() {
  beep(85 + Math.random() * 20, 0.05, 'sine', 0.035);
}

/** Same footstep, much quieter — for customers/NPCs walking in the background. */
export function playFootstepFaint() {
  beep(80 + Math.random() * 20, 0.045, 'sine', 0.014);
}
