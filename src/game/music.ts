import { getCtx } from './audio';

// Background music, real-track-first: if public/music/<mood>.mp3 exists,
// that plays, looped; if it 404s (no file dropped in yet), this falls back
// to a procedurally-generated ambient loop for that scene — same fallback
// shape as cardArt.ts's illustrated-art-first / procedural-SVG-fallback
// chain. See public/music/README.md for exactly what file to add and where.
//
// Deliberately a relative path (no leading slash) — same reason as
// cardArtImagePath(): the published Artifact preview doesn't always serve
// index.html from a domain root, so an absolute /music/... path can 404
// there even once the file exists right alongside it.
const REAL_TRACK_PATH: Record<SceneMood, string> = {
  shop: 'music/shop.mp3',
  town: 'music/town.mp3',
  wilds: 'music/wilds.mp3',
  distributor: 'music/distributor.mp3',
  generalStore: 'music/general-store.mp3',
};

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
  // Real-track state: cached <audio> elements (one per mood, created lazily
  // and reused — a MediaElementAudioSourceNode can only ever be attached to
  // an element once), which mood(s) have already 404'd and should just use
  // the procedural loop from now on, and whichever element is playing now.
  private realTrackEls = new Map<SceneMood, HTMLAudioElement>();
  private realTrackFailed = new Set<SceneMood>();
  private currentRealAudio: HTMLAudioElement | null = null;

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
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.currentRealAudio) {
      this.currentRealAudio.pause();
      this.currentRealAudio = null;
    }
    const ctx = this.ensureGraph();
    if (!ctx) return; // No Web Audio available — silently do nothing, same as SFX.

    if (this.realTrackFailed.has(mood)) this.startProceduralLoop(mood);
    else this.tryPlayRealTrack(mood, ctx);
  }

  /** Tries public/music/<mood>.mp3 first; falls back to the procedural loop
   * the moment it's clear the file isn't there (a fired 'error' event, or a
   * rejected play() — some browsers surface a missing file that way instead). */
  private tryPlayRealTrack(mood: SceneMood, ctx: AudioContext) {
    const fallback = () => {
      this.realTrackFailed.add(mood);
      if (this.currentMood === mood) this.startProceduralLoop(mood);
    };
    let el = this.realTrackEls.get(mood);
    if (!el) {
      el = new Audio(REAL_TRACK_PATH[mood]);
      el.loop = true;
      el.preload = 'auto';
      el.addEventListener('error', fallback);
      this.realTrackEls.set(mood, el);
      try {
        const source = ctx.createMediaElementSource(el);
        source.connect(this.masterGain!);
      } catch {
        // If it can't be routed through the shared graph, let it play
        // un-gained rather than breaking playback entirely.
      }
    }
    this.currentRealAudio = el;
    el.currentTime = 0;
    el.play()?.catch(fallback);
  }

  private startProceduralLoop(mood: SceneMood) {
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
