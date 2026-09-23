import { getCtx } from './audio';

// Procedurally-generated ambient background music — same "placeholder now,
// real assets later" philosophy as audio.ts's SFX and cardArt.ts's SVG
// fallback creatures, since there's no music-generation tool available
// either. Each scene gets its own slowly-evolving chord loop with a sparse
// wandering melody on top, built from plain oscillators — no audio files,
// no external dependencies, just enough harmonic movement that the valley
// doesn't sit in dead silence between sound effects.

export type SceneMood = 'shop' | 'town' | 'wilds' | 'distributor' | 'generalStore';

interface MoodConfig {
  /** Base frequency (Hz) everything else is built from as semitone offsets. */
  rootFreq: number;
  /** Each chord is a list of semitone offsets from rootFreq, played as one
   * slow overlapping pad hit; the loop cycles through them in order. */
  chords: number[][];
  /** Semitone offsets (can span >1 octave) the sparse melody picks from. */
  melodyDegrees: number[];
  /** How long one chord (one "bar") lasts, in ms. */
  barMs: number;
  /** Chance per bar of a melody note (or two) playing at all. */
  melodyDensity: number;
  padWave: OscillatorType;
  melodyWave: OscillatorType;
  padGain: number;
  melodyGain: number;
}

// Frequencies are picked independently per scene (not a shared scale
// transposed) so each place has its own distinct register and character
// rather than feeling like the same song in a different key.
const SCENE_MOODS: Record<SceneMood, MoodConfig> = {
  shop: {
    // Warm, unhurried major-ish pad — the counter is a calm place to be.
    rootFreq: 220, // A3
    chords: [
      [0, 4, 7],
      [9, 12, 16],
      [5, 9, 12],
      [7, 11, 14],
    ],
    melodyDegrees: [12, 14, 16, 19, 21, 24],
    barMs: 3200,
    melodyDensity: 0.55,
    padWave: 'sine',
    melodyWave: 'triangle',
    padGain: 0.02,
    melodyGain: 0.035,
  },
  town: {
    // Brighter and a little quicker — an open, lived-in square.
    rootFreq: 261.63, // C4
    chords: [
      [0, 4, 7],
      [7, 11, 14],
      [9, 12, 16],
      [5, 9, 12],
    ],
    melodyDegrees: [12, 14, 16, 19, 21],
    barMs: 2600,
    melodyDensity: 0.65,
    padWave: 'triangle',
    melodyWave: 'sine',
    padGain: 0.018,
    melodyGain: 0.04,
  },
  wilds: {
    // Low, sparse, minor — open fifths for an unresolved, watchful feel.
    rootFreq: 146.83, // D3
    chords: [
      [0, 3, 7],
      [8, 12, 15],
      [5, 8, 12],
      [7, 10, 14],
    ],
    melodyDegrees: [12, 15, 17, 19, 22],
    barMs: 3800,
    melodyDensity: 0.35,
    padWave: 'sine',
    melodyWave: 'sine',
    padGain: 0.022,
    melodyGain: 0.025,
  },
  distributor: {
    // A shade busier/business-like — added 7ths for a "counting inventory" feel.
    rootFreq: 174.61, // F3
    chords: [
      [0, 4, 7, 11],
      [9, 12, 16, 19],
      [5, 9, 12, 16],
      [7, 11, 14, 17],
    ],
    melodyDegrees: [12, 14, 16, 19, 23],
    barMs: 2900,
    melodyDensity: 0.5,
    padWave: 'triangle',
    melodyWave: 'triangle',
    padGain: 0.018,
    melodyGain: 0.032,
  },
  generalStore: {
    // Airy and a little brighter/higher — sundries and daylight.
    rootFreq: 293.66, // D4
    chords: [
      [0, 4, 7],
      [9, 12, 16],
      [2, 7, 11],
      [5, 9, 12],
    ],
    melodyDegrees: [12, 16, 19, 24, 26],
    barMs: 3000,
    melodyDensity: 0.6,
    padWave: 'sine',
    melodyWave: 'triangle',
    padGain: 0.017,
    melodyGain: 0.038,
  },
};

class MusicManager {
  private masterGain: GainNode | null = null;
  private currentMood: SceneMood | null = null;
  private chordIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private muted = false;
  private volume = 0.5;

  /** Called once at startup with the player's saved preference, before any
   * scene has had a chance to start a loop. */
  init(muted: boolean, volume: number) {
    this.muted = muted;
    this.volume = volume;
  }

  private ensureGraph(): AudioContext | null {
    const ctx = getCtx();
    if (!ctx) return null;
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(ctx.destination);
    }
    return ctx;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    const ctx = getCtx();
    if (ctx && this.masterGain) this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, ctx.currentTime, 0.05);
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    const ctx = getCtx();
    if (ctx && this.masterGain && !this.muted) this.masterGain.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.05);
  }

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }

  getCurrentMood(): SceneMood | null {
    return this.currentMood;
  }

  /** Starts (or switches to) the ambient loop for a scene. A no-op if it's
   * already playing — scenes call this unconditionally from create(). */
  playScene(mood: SceneMood) {
    if (this.currentMood === mood) return;
    this.currentMood = mood;
    this.chordIndex = 0;
    if (this.intervalId) clearInterval(this.intervalId);
    const ctx = this.ensureGraph();
    if (!ctx) return; // No Web Audio available — silently do nothing, same as SFX.

    const config = SCENE_MOODS[mood];
    const tick = () => this.playBar(mood, config);
    tick();
    this.intervalId = setInterval(tick, config.barMs);
  }

  private playBar(mood: SceneMood, config: MoodConfig) {
    // The scene may have changed again since this timer was scheduled —
    // don't let a stale interval from a previous scene bleed through.
    if (this.currentMood !== mood || !this.masterGain) return;
    const chord = config.chords[this.chordIndex % config.chords.length];
    this.chordIndex += 1;
    const barSec = config.barMs / 1000;

    // Pad: the chord's tones, long slow-attack notes that overlap the next
    // bar's — that overlap is what makes the chord changes sound like a
    // legato crossfade instead of a hard cut.
    chord.forEach((semi, i) => {
      this.tone(config.rootFreq * 2 ** (semi / 12), barSec * 1.8, config.padWave, config.padGain, i * 0.06, false);
    });

    // A sparse, randomized melody note or two on top so the loop doesn't
    // feel mechanically identical bar to bar.
    if (Math.random() < config.melodyDensity) {
      const noteCount = 1 + (Math.random() < 0.3 ? 1 : 0);
      for (let n = 0; n < noteCount; n++) {
        const degree = config.melodyDegrees[Math.floor(Math.random() * config.melodyDegrees.length)];
        const delay = Math.random() * barSec * 0.75;
        this.tone(config.rootFreq * 2 ** (degree / 12), 0.5 + Math.random() * 0.5, config.melodyWave, config.melodyGain, delay, true);
      }
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainPeak: number, delay: number, pluck: boolean) {
    const ctx = getCtx();
    if (!ctx || !this.masterGain) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(this.masterGain);
      const t0 = ctx.currentTime + delay;
      const attack = pluck ? 0.02 : duration * 0.35;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(gainPeak, t0 + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch {
      // Music is a nice-to-have — never let it break gameplay.
    }
  }
}

export const musicManager = new MusicManager();
