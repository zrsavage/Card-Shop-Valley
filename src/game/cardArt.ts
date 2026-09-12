import type { Rarity, Season } from './types';
import { seededRandom } from './species';

// Deterministic procedural "art": the same speciesId always produces the same
// base creature (shape + palette), while `stage` escalates size, ornament
// count, and aura strength so an evolved form visibly looks more elaborate —
// this repo has no image-generation tool available, so unique art per card
// means unique generated vector art rather than illustrated/painted pieces.

const SEASON_PALETTES: Record<Season, string[]> = {
  Spring: ['#8bc34a', '#aed581', '#c5e1a5', '#558b2f', '#33691e'],
  Summer: ['#ffb703', '#fb8500', '#219ebc', '#8ecae6', '#e63946'],
  Fall: ['#d08c3a', '#a15c2b', '#8d6e63', '#c1440e', '#6d4c41'],
  Winter: ['#8ecae6', '#a2d2ff', '#caf0f8', '#adb5bd', '#48cae4'],
};

const RARITY_GLOW: Record<Rarity, string> = {
  common: '#8bd3ff',
  uncommon: '#7ee787',
  rare: '#ffd166',
  epic: '#c77dff',
  legendary: '#ff6b6b',
};

type BodyShape = 'blob' | 'quadruped' | 'bird' | 'serpent' | 'insectoid' | 'spirit' | 'golem';
const BODY_SHAPES: BodyShape[] = ['blob', 'quadruped', 'bird', 'serpent', 'insectoid', 'spirit', 'golem'];

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function eyesSvg(cx: number, cy: number, spread: number): string {
  return `
    <circle cx="${cx - spread}" cy="${cy}" r="2.6" fill="#241a12"/>
    <circle cx="${cx + spread}" cy="${cy}" r="2.6" fill="#241a12"/>
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
    spikes += `<polygon points="${bx - 3},${by} ${bx + 3},${by} ${bx},${by - 9}" fill="${accent}"/>`;
  }
  return `
    <ellipse cx="50" cy="58" rx="${rx}" ry="${ry}" fill="${body}"/>
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
    mane = `<ellipse cx="70" cy="42" rx="13" ry="9" fill="${accent}" opacity="0.8"/>`;
  }
  return `
    <path d="M28 62 Q20 50 30 44 Q26 56 36 62 Z" fill="${body}"/>
    <ellipse cx="52" cy="60" rx="${26 * scale}" ry="${15 * scale}" fill="${body}"/>
    ${mane}
    <circle cx="76" cy="48" r="13" fill="${body}"/>
    <polygon points="68,38 72,28 76,38" fill="${body}"/>
    <polygon points="80,38 84,28 88,38" fill="${body}"/>
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
    <ellipse cx="50" cy="60" rx="${17 * scale}" ry="${22 * scale}" fill="${body}"/>
    <polygon points="30,${58 - wingSweep} 8,52 30,66" fill="${accent}"/>
    <polygon points="70,${58 - wingSweep} 92,52 70,66" fill="${accent}"/>
    <circle cx="50" cy="34" r="12" fill="${body}"/>
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
    coils += `<ellipse cx="${50 + dir * (14 + rand() * 4)}" cy="${y}" rx="${coilWidth}" ry="9" fill="${i % 2 === 0 ? body : accent}"/>`;
  }
  return `
    ${coils}
    <circle cx="50" cy="22" r="11" fill="${body}"/>
    <polygon points="46,14 50,6 54,14" fill="${accent}"/>
    <path d="M50 30 L54 36 L48 36 Z" fill="#e63946"/>
    ${eyesSvg(50, 20, 4)}
  `;
}

function buildInsectoid(rand: () => number, body: string, accent: string, stage: number): string {
  const segJitter = rand() * 3;
  const segments = `
    <ellipse cx="50" cy="42" rx="${13 + segJitter}" ry="11" fill="${body}"/>
    <ellipse cx="50" cy="60" rx="${16 + segJitter}" ry="14" fill="${body}"/>
    <ellipse cx="50" cy="78" rx="${13 + segJitter}" ry="12" fill="${accent}"/>
  `;
  const legs = [0, 1, 2].map((i) => {
    const y = 50 + i * 10;
    return `<line x1="38" y1="${y}" x2="20" y2="${y + 8}" stroke="${accent}" stroke-width="2"/><line x1="62" y1="${y}" x2="80" y2="${y + 8}" stroke="${accent}" stroke-width="2"/>`;
  }).join('');
  const antennae = `<line x1="44" y1="32" x2="38" y2="16" stroke="${accent}" stroke-width="2"/><line x1="56" y1="32" x2="62" y2="16" stroke="${accent}" stroke-width="2"/>`;
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
    <path d="M50 20 C${30 - widen} 20 ${24 - widen} 48 30 66 C34 80 66 80 70 66 C${76 + widen} 48 ${70 + widen} 20 50 20 Z" fill="${body}"/>
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
    <rect x="${28 - (bodyWidth - 48) / 2}" y="30" width="${bodyWidth}" height="46" rx="8" fill="${body}"/>
    <rect x="14" y="36" width="12" height="26" rx="4" fill="${accent}"/>
    <rect x="74" y="36" width="12" height="26" rx="4" fill="${accent}"/>
    <rect x="34" y="76" width="12" height="16" rx="4" fill="${accent}"/>
    <rect x="54" y="76" width="12" height="16" rx="4" fill="${accent}"/>
    <circle cx="50" cy="54" r="${coreRadius}" fill="${accent}" opacity="0.9"/>
    ${runes}
    ${eyesSvg(50, 40, 8)}
  `;
}

export function generateCardArtSvg(speciesId: string, season: Season, rarity: Rarity, stage: number): string {
  const rand = seededRandom(speciesId);
  const palette = SEASON_PALETTES[season];
  const body = pick(rand, palette);
  let accent = pick(rand, palette);
  if (accent === body) accent = palette[(palette.indexOf(accent) + 1) % palette.length];
  const shape = pick(rand, BODY_SHAPES);
  const glow = RARITY_GLOW[rarity];

  let creature: string;
  switch (shape) {
    case 'blob':
      creature = buildBlob(rand, body, accent, stage);
      break;
    case 'quadruped':
      creature = buildQuadruped(rand, body, accent, stage);
      break;
    case 'bird':
      creature = buildBird(rand, body, accent, stage);
      break;
    case 'serpent':
      creature = buildSerpent(rand, body, accent, stage);
      break;
    case 'insectoid':
      creature = buildInsectoid(rand, body, accent, stage);
      break;
    case 'spirit':
      creature = buildSpirit(rand, body, accent, stage);
      break;
    case 'golem':
      creature = buildGolem(rand, body, accent, stage);
      break;
  }

  const aura = stage >= 2 ? auraSvg(50, 55, 38 + stage * 2, glow, 0.25 + stage * 0.08) : '';
  const sparkles = stage >= 4 ? sparklesSvg(seededRandom(`${speciesId}-sparkle-${stage}`), stage, glow) : '';

  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="card-art-svg">${aura}${creature}${sparkles}</svg>`;
}
