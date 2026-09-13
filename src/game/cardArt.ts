import type { Rarity, Season } from './types';
import { seededRandom } from './species';

// Deterministic procedural "art": the same speciesId always produces the same
// base creature (shape + palette), while `stage` escalates size, ornament
// count, and aura strength so an evolved form visibly looks more elaborate —
// this repo has no image-generation tool available, so unique art per card
// means unique generated vector art rather than illustrated/painted pieces.
// Gradient shading, a cast shadow, an ink outline, and a warm backdrop glow
// give each icon some depth instead of reading as a flat colored sticker.

const SEASON_PALETTES: Record<Season, string[]> = {
  Spring: ['#8bc34a', '#aed581', '#c5e1a5', '#558b2f', '#33691e'],
  Summer: ['#ffb703', '#fb8500', '#219ebc', '#8ecae6', '#e63946'],
  Fall: ['#d08c3a', '#a15c2b', '#8d6e63', '#c1440e', '#6d4c41'],
  Winter: ['#8ecae6', '#a2d2ff', '#caf0f8', '#adb5bd', '#48cae4'],
};

const SEASON_BACKDROP: Record<Season, string> = {
  Spring: '#fff6d8',
  Summer: '#fff0d2',
  Fall: '#ffe9cf',
  Winter: '#eef7ff',
};

const RARITY_GLOW: Record<Rarity, string> = {
  common: '#8bd3ff',
  uncommon: '#7ee787',
  rare: '#ffd166',
  epic: '#c77dff',
  legendary: '#ff6b6b',
};

const INK = '#2b1d0e';

// --- Color math for gradient shading (mixing toward warm dark brown for
// shadows, rather than pure black, keeps the cartoon-warm palette). ---

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mixColors(hex1: string, hex2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function lighten(hex: string, amount: number): string {
  return mixColors(hex, '#ffffff', amount);
}

function darken(hex: string, amount: number): string {
  return mixColors(hex, INK, amount);
}

type BodyShape = 'blob' | 'quadruped' | 'bird' | 'serpent' | 'insectoid' | 'spirit' | 'golem';
const BODY_SHAPES: BodyShape[] = ['blob', 'quadruped', 'bird', 'serpent', 'insectoid', 'spirit', 'golem'];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function eyesSvg(cx: number, cy: number, spread: number): string {
  return `
    <circle cx="${cx - spread}" cy="${cy}" r="2.6" fill="${INK}"/>
    <circle cx="${cx + spread}" cy="${cy}" r="2.6" fill="${INK}"/>
    <circle cx="${cx - spread + 0.9}" cy="${cy - 0.9}" r="0.9" fill="#fff"/>
    <circle cx="${cx + spread + 0.9}" cy="${cy - 0.9}" r="0.9" fill="#fff"/>
  `;
}

function auraSvg(cx: number, cy: number, r: number, color: string, opacity: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5" opacity="${opacity}"/>`;
}

function sparklesSvg(rand: () => number, count: number, color: string): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = 32 + rand() * 8;
    const x = 50 + Math.cos(angle) * dist;
    const y = 55 + Math.sin(angle) * dist * 0.9;
    const s = 2 + rand() * 1.5;
    out += `<path d="M${x} ${y - s} L${x + s * 0.3} ${y - s * 0.3} L${x + s} ${y} L${x + s * 0.3} ${y + s * 0.3} L${x} ${y + s} L${x - s * 0.3} ${y + s * 0.3} L${x - s} ${y} L${x - s * 0.3} ${y - s * 0.3} Z" fill="${color}" opacity="0.85"/>`;
  }
  return out;
}

const OUTLINE = `stroke="${INK}" stroke-width="1.4" stroke-opacity="0.55"`;

function buildBlob(rand: () => number, body: string, accent: string, stage: number): string {
  const scale = 1 + (stage - 1) * 0.05 + (rand() - 0.5) * 0.1;
  const rx = 24 * scale;
  const ry = 20 * scale * (0.9 + rand() * 0.2);
  let spikes = '';
  const spikeCount = Math.max(0, stage - 1);
  for (let i = 0; i < spikeCount; i++) {
    const angle = -160 + i * (320 / Math.max(1, spikeCount)) + (rand() - 0.5) * 16;
    const rad = (angle * Math.PI) / 180;
    const bx = 50 + Math.cos(rad) * rx * 0.85;
    const by = 55 + Math.sin(rad) * ry * 0.85 - ry * 0.35;
    spikes += `<polygon points="${bx - 3},${by} ${bx + 3},${by} ${bx},${by - 9}" fill="${accent}" ${OUTLINE}/>`;
  }
  return `
    <ellipse cx="50" cy="58" rx="${rx}" ry="${ry}" fill="${body}" ${OUTLINE}/>
    ${spikes}
    ${eyesSvg(50, 54, 7)}
  `;
}

function buildQuadruped(rand: () => number, body: string, accent: string, stage: number): string {
  const scale = 1 + (stage - 1) * 0.04 + (rand() - 0.5) * 0.08;
  const legJitter = rand() * 3;
  const legs = [30, 42, 58, 70]
    .map((x) => `<rect x="${x - 3}" y="${66 + legJitter}" width="6" height="${16 - legJitter}" rx="2" fill="${accent}"/>`)
    .join('');
  let mane = '';
  if (stage >= 3) {
    mane = `<ellipse cx="70" cy="42" rx="13" ry="9" fill="${accent}" opacity="0.85"/>`;
  }
  return `
    <path d="M28 62 Q20 50 30 44 Q26 56 36 62 Z" fill="${body}" ${OUTLINE}/>
    <ellipse cx="52" cy="60" rx="${26 * scale}" ry="${15 * scale}" fill="${body}" ${OUTLINE}/>
    ${mane}
    <circle cx="76" cy="48" r="13" fill="${body}" ${OUTLINE}/>
    <polygon points="68,38 72,28 76,38" fill="${body}" ${OUTLINE}/>
    <polygon points="80,38 84,28 88,38" fill="${body}" ${OUTLINE}/>
    ${legs}
    ${eyesSvg(78, 47, 5)}
  `;
}

function buildBird(rand: () => number, body: string, accent: string, stage: number): string {
  const scale = 1 + (stage - 1) * 0.04 + (rand() - 0.5) * 0.08;
  const wingSweep = 6 + rand() * 8;
  const crestCount = Math.max(0, stage - 1);
  let crest = '';
  for (let i = 0; i < crestCount; i++) {
    const x = 44 + i * 6;
    crest += `<polygon points="${x},32 ${x + 3},20 ${x + 6},32" fill="${accent}"/>`;
  }
  return `
    <ellipse cx="50" cy="60" rx="${17 * scale}" ry="${22 * scale}" fill="${body}" ${OUTLINE}/>
    <polygon points="30,${58 - wingSweep} 8,52 30,66" fill="${accent}" ${OUTLINE}/>
    <polygon points="70,${58 - wingSweep} 92,52 70,66" fill="${accent}" ${OUTLINE}/>
    <circle cx="50" cy="34" r="12" fill="${body}" ${OUTLINE}/>
    <polygon points="50,34 64,38 50,42" fill="${accent}"/>
    ${crest}
    <polygon points="44,80 50,94 56,80" fill="${accent}"/>
    ${eyesSvg(53, 32, 4)}
  `;
}

function buildSerpent(rand: () => number, body: string, accent: string, stage: number): string {
  const coilCount = Math.max(1, stage);
  const coilWidth = 14 + rand() * 4;
  let coils = '';
  for (let i = 0; i < coilCount; i++) {
    const y = 30 + i * (55 / coilCount);
    const dir = i % 2 === 0 ? 1 : -1;
    coils += `<ellipse cx="${50 + dir * (14 + rand() * 4)}" cy="${y}" rx="${coilWidth}" ry="9" fill="${i % 2 === 0 ? body : accent}" ${OUTLINE}/>`;
  }
  return `
    ${coils}
    <circle cx="50" cy="22" r="11" fill="${body}" ${OUTLINE}/>
    <polygon points="46,14 50,6 54,14" fill="${accent}" ${OUTLINE}/>
    <path d="M50 30 L54 36 L48 36 Z" fill="#e63946"/>
    ${eyesSvg(50, 20, 4)}
  `;
}

function buildInsectoid(rand: () => number, body: string, accent: string, stage: number): string {
  const segJitter = rand() * 3;
  const segments = `
    <ellipse cx="50" cy="42" rx="${13 + segJitter}" ry="11" fill="${body}" ${OUTLINE}/>
    <ellipse cx="50" cy="60" rx="${16 + segJitter}" ry="14" fill="${body}" ${OUTLINE}/>
    <ellipse cx="50" cy="78" rx="${13 + segJitter}" ry="12" fill="${accent}" ${OUTLINE}/>
  `;
  const legs = [0, 1, 2].map((i) => {
    const y = 50 + i * 10;
    return `<line x1="38" y1="${y}" x2="20" y2="${y + 8}" stroke="${INK}" stroke-width="2" stroke-opacity="0.7"/><line x1="62" y1="${y}" x2="80" y2="${y + 8}" stroke="${INK}" stroke-width="2" stroke-opacity="0.7"/>`;
  }).join('');
  const antennae = `<line x1="44" y1="32" x2="38" y2="16" stroke="${INK}" stroke-width="2" stroke-opacity="0.7"/><line x1="56" y1="32" x2="62" y2="16" stroke="${INK}" stroke-width="2" stroke-opacity="0.7"/>`;
  let wings = '';
  if (stage >= 3) {
    const wingSize = 14 + (stage - 3) * 4;
    wings = `<ellipse cx="30" cy="48" rx="${wingSize}" ry="${wingSize * 0.6}" fill="${accent}" opacity="0.55" transform="rotate(-20 30 48)"/><ellipse cx="70" cy="48" rx="${wingSize}" ry="${wingSize * 0.6}" fill="${accent}" opacity="0.55" transform="rotate(20 70 48)"/>`;
  }
  return `${wings}${segments}${legs}${antennae}${eyesSvg(50, 40, 5)}`;
}

function buildSpirit(rand: () => number, body: string, accent: string, stage: number): string {
  const widen = rand() * 6;
  const wispCount = Math.max(1, stage);
  let wisps = '';
  for (let i = 0; i < wispCount; i++) {
    const x = 36 + i * (28 / wispCount);
    const sway = 6 + (i % 2) * 4 + rand() * 4;
    wisps += `<path d="M${x} 72 Q${x + sway} 84 ${x} 94" stroke="${accent}" stroke-width="3" fill="none" opacity="0.8"/>`;
  }
  return `
    <path d="M50 20 C${30 - widen} 20 ${24 - widen} 48 30 66 C34 80 66 80 70 66 C${76 + widen} 48 ${70 + widen} 20 50 20 Z" fill="${body}" ${OUTLINE}/>
    ${wisps}
    ${eyesSvg(50, 46, 6)}
  `;
}

function buildGolem(rand: () => number, body: string, accent: string, stage: number): string {
  const coreRadius = 6 + stage * 1.4 + rand() * 2;
  const bodyWidth = 44 + rand() * 8;
  let runes = '';
  for (let i = 0; i < stage - 1; i++) {
    const y = 30 + i * 10;
    runes += `<rect x="46" y="${y}" width="8" height="2" fill="${accent}" opacity="0.9"/>`;
  }
  return `
    <rect x="${28 - (bodyWidth - 48) / 2}" y="30" width="${bodyWidth}" height="46" rx="8" fill="${body}" ${OUTLINE}/>
    <rect x="14" y="36" width="12" height="26" rx="4" fill="${accent}" ${OUTLINE}/>
    <rect x="74" y="36" width="12" height="26" rx="4" fill="${accent}" ${OUTLINE}/>
    <rect x="34" y="76" width="12" height="16" rx="4" fill="${accent}" ${OUTLINE}/>
    <rect x="54" y="76" width="12" height="16" rx="4" fill="${accent}" ${OUTLINE}/>
    <circle cx="50" cy="54" r="${coreRadius}" fill="${accent}" opacity="0.95"/>
    ${runes}
    ${eyesSvg(50, 40, 8)}
  `;
}

// Path to a hand-painted illustration for this species, if one has been
// generated (see /public/card-art). One image is shared across all of a
// species' evolution stages; the UI falls back to the procedural SVG below
// when the file doesn't exist yet, so art can be rolled out incrementally.
export function cardArtImagePath(speciesId: string): string {
  return `/card-art/${speciesId}.webp`;
}

export function generateCardArtSvg(speciesId: string, season: Season, rarity: Rarity, stage: number): string {
  const rand = seededRandom(speciesId);
  const palette = SEASON_PALETTES[season];
  const bodyBase = pick(rand, palette);
  let accentBase = pick(rand, palette);
  if (accentBase === bodyBase) accentBase = palette[(palette.indexOf(accentBase) + 1) % palette.length];
  const shape = pick(rand, BODY_SHAPES);
  const glow = RARITY_GLOW[rarity];
  const uid = `${speciesId.replace(/[^a-zA-Z0-9]/g, '')}-${stage}`;

  // Gradient-shaded fills (light source upper-left) instead of flat color,
  // for a rounded, lit look rather than a flat sticker.
  const bodyFill = `url(#g-body-${uid})`;
  const accentFill = `url(#g-accent-${uid})`;

  let creature: string;
  switch (shape) {
    case 'blob':
      creature = buildBlob(rand, bodyFill, accentFill, stage);
      break;
    case 'quadruped':
      creature = buildQuadruped(rand, bodyFill, accentFill, stage);
      break;
    case 'bird':
      creature = buildBird(rand, bodyFill, accentFill, stage);
      break;
    case 'serpent':
      creature = buildSerpent(rand, bodyFill, accentFill, stage);
      break;
    case 'insectoid':
      creature = buildInsectoid(rand, bodyFill, accentFill, stage);
      break;
    case 'spirit':
      creature = buildSpirit(rand, bodyFill, accentFill, stage);
      break;
    case 'golem':
      creature = buildGolem(rand, bodyFill, accentFill, stage);
      break;
  }

  const defs = `
    <defs>
      <radialGradient id="g-body-${uid}" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stop-color="${lighten(bodyBase, 0.4)}"/>
        <stop offset="55%" stop-color="${bodyBase}"/>
        <stop offset="100%" stop-color="${darken(bodyBase, 0.4)}"/>
      </radialGradient>
      <radialGradient id="g-accent-${uid}" cx="38%" cy="32%" r="75%">
        <stop offset="0%" stop-color="${lighten(accentBase, 0.35)}"/>
        <stop offset="55%" stop-color="${accentBase}"/>
        <stop offset="100%" stop-color="${darken(accentBase, 0.4)}"/>
      </radialGradient>
      <radialGradient id="g-backdrop-${uid}" cx="50%" cy="42%" r="60%">
        <stop offset="0%" stop-color="${SEASON_BACKDROP[season]}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="${SEASON_BACKDROP[season]}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="g-shadow-${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${INK}" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="${INK}" stop-opacity="0"/>
      </radialGradient>
      <filter id="f-shadow-${uid}" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2.5" stdDeviation="1.8" flood-color="${INK}" flood-opacity="0.4"/>
      </filter>
    </defs>
  `;

  const backdrop = `<circle cx="50" cy="50" r="46" fill="url(#g-backdrop-${uid})"/>`;
  const groundShadow = `<ellipse cx="50" cy="88" rx="26" ry="6" fill="url(#g-shadow-${uid})"/>`;
  const aura = stage >= 2 ? auraSvg(50, 55, 38 + stage * 2, glow, 0.25 + stage * 0.08) : '';
  const sparkles = stage >= 4 ? sparklesSvg(seededRandom(`${speciesId}-sparkle-${stage}`), stage, glow) : '';
  // A small glossy highlight reads as a light catching the creature's back —
  // cheap, shape-agnostic way to add "beauty" without per-shape logic.
  const gloss = `<ellipse cx="41" cy="42" rx="7" ry="4" fill="#ffffff" opacity="0.3" transform="rotate(-25 41 42)"/>`;

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="card-art-svg">
    ${defs}
    ${backdrop}
    ${aura}
    ${groundShadow}
    <g filter="url(#f-shadow-${uid})">${creature}${gloss}</g>
    ${sparkles}
  </svg>`;
}
