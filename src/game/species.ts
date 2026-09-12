import type { Rarity, Season } from './types';

// --- Deterministic seeded RNG so the same species/stage always looks and
// prices the same across reloads, instead of regenerating randomly. ---

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRandom(seed: string): () => number {
  return mulberry32(hashString(seed));
}

// Each season's expansion set has its own name, like a real TCG set.
export const SEASON_SET_NAME: Record<Season, string> = {
  Spring: 'Spring Spritz',
  Summer: 'Summer Shandy',
  Fall: 'Fall Cider',
  Winter: 'Winter Toddy',
};

interface SeasonNameKit {
  /** First syllable fragment of an invented root name. */
  rootStart: string[];
  /** Second syllable fragment of an invented root name. */
  rootEnd: string[];
  /**
   * Suffix appended to the root for stages 1-5 (index 0 = stage 1, always '').
   * Names get visibly longer/grander each evolution, Digimon-style.
   */
  stageSuffix: [string, string, string, string, string];
  legendaryEpithet: string;
}

const NAME_KIT: Record<Season, SeasonNameKit> = {
  Spring: {
    rootStart: ['Ver', 'Flo', 'Pri', 'Spro', 'Blo', 'Fer', 'Lu', 'Vi', 'Pe', 'Ny', 'Zi', 'Ro', 'Wil', 'Ta', 'Ely', 'Bri', 'Sil', 'Cor', 'My', 'Sa'],
    rootEnd: ['ana', 'ora', 'ella', 'wen', 'lin', 'osa', 'ith', 'ara', 'yn', 'iel', 'ova', 'eth', 'ika', 'una', 'ael', 'iss', 'ent', 'yra', 'avel', 'oshi'],
    stageSuffix: ['', 'wyn', 'dral', 'thorn', 'essa'],
    legendaryEpithet: 'the Everblooming Sovereign',
  },
  Summer: {
    rootStart: ['Zar', 'Sol', 'Blaz', 'Pyr', 'Kai', 'Rey', 'Tor', 'Vul', 'Xan', 'Dez', 'Cor', 'Az', 'Emb', 'Ryn', 'Dax', 'Kor', 'Zeph', 'Sur', 'Val', 'Brin'],
    rootEnd: ['ados', 'ion', 'ax', 'ara', 'oth', 'iel', 'yx', 'ando', 'iro', 'ez', 'oria', 'ash', 'urn', 'ivor', 'aros', 'exis', 'ova', 'ynx', 'adon', 'irae'],
    stageSuffix: ['', 'lux', 'dune', 'zorn', 'helia'],
    legendaryEpithet: 'the Sunfire Sovereign',
  },
  Fall: {
    rootStart: ['Cor', 'Rus', 'Mor', 'Dur', 'Gol', 'Thal', 'Bram', 'Wyr', 'Hol', 'Fen', 'Grov', 'Ked', 'Sor', 'Vosh', 'Quil', 'Bran', 'Drav', 'Nor', 'Cros', 'Hev'],
    rootEnd: ['wood', 'ath', 'orn', 'ust', 'ard', 'eth', 'ow', 'ic', 'ald', 'ost', 'ven', 'ick', 'oth', 'ind', 'ander', 'ash', 'ett', 'ric', 'ove', 'und'],
    stageSuffix: ['', 'crow', 'dusk', 'wither', 'reap'],
    legendaryEpithet: 'the Harvestbound Sovereign',
  },
  Winter: {
    rootStart: ['Fro', 'Gla', 'Ry', 'Vry', 'Kry', 'Sko', 'Bly', 'Whi', 'Niv', 'Isk', 'Fri', 'Sno', 'Cael', 'Thren', 'Vel', 'Aur', 'Bor', 'Crys', 'Hail', 'Pale'],
    rootEnd: ['ost', 'acia', 'ithe', 'orin', 'ara', 'ivy', 'ell', 'ora', 'ist', 'aeth', 'yn', 'osk', 'ende', 'iven', 'ael', 'orra', 'ynx', 'ast', 'eth', 'iel'],
    stageSuffix: ['', 'rime', 'glace', 'boreth', 'aurora'],
    legendaryEpithet: 'the Frostbound Sovereign',
  },
};

// Rarity tier a card lands in, indexed by its stage (1-5).
const STAGE_RARITY: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

// Extra value multiplier stacked on top of the rarity's own base value —
// this is what makes an evolved card worth more than a same-tier "base" card.
export const STAGE_VALUE_MULTIPLIER = [1.0, 1.4, 1.9, 2.5, 3.2];

export const SPECIES_PER_SEASON = 150;

export interface SpeciesCard {
  speciesId: string;
  name: string;
  stage: number;
  stageCount: number;
  rarity: Rarity;
}

function buildStageNames(kit: SeasonNameKit, root: string, stageCount: number): string[] {
  const names: string[] = [];
  for (let stage = 1; stage <= stageCount; stage++) {
    const base = `${root}${kit.stageSuffix[stage - 1]}`;
    names.push(stage === 5 ? `${base}, ${kit.legendaryEpithet}` : base);
  }
  return names;
}

function buildSeasonSpecies(season: Season): SpeciesCard[][] {
  const kit = NAME_KIT[season];
  const rand = seededRandom(`species-seed-${season}`);

  const roots: string[] = [];
  for (const start of kit.rootStart) {
    for (const end of kit.rootEnd) {
      roots.push(`${start}${end}`);
    }
  }
  // Deterministic Fisher-Yates shuffle, then take the first SPECIES_PER_SEASON roots.
  for (let i = roots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [roots[i], roots[j]] = [roots[j], roots[i]];
  }
  const chosen = roots.slice(0, SPECIES_PER_SEASON);

  return chosen.map((root, idx) => {
    const roll = rand();
    const stageCount = roll < 0.1 ? 5 : roll < 0.3 ? 4 : 3;
    const speciesId = `${season}-${idx}`;
    const names = buildStageNames(kit, root, stageCount);
    return names.map((name, i) => ({
      speciesId,
      name,
      stage: i + 1,
      stageCount,
      rarity: STAGE_RARITY[i],
    }));
  });
}

// Built once per module load — deterministic, so it's stable for the whole session.
const SEASON_SPECIES: Record<Season, SpeciesCard[][]> = {
  Spring: buildSeasonSpecies('Spring'),
  Summer: buildSeasonSpecies('Summer'),
  Fall: buildSeasonSpecies('Fall'),
  Winter: buildSeasonSpecies('Winter'),
};

// Flattened per-season, per-rarity pools that packs pull individual cards from.
export const SEASON_CARD_POOL: Record<Season, Record<Rarity, SpeciesCard[]>> = (() => {
  const seasons = Object.keys(SEASON_SPECIES) as Season[];
  const result = {} as Record<Season, Record<Rarity, SpeciesCard[]>>;
  for (const season of seasons) {
    const byRarity: Record<Rarity, SpeciesCard[]> = {
      common: [], uncommon: [], rare: [], epic: [], legendary: [],
    };
    for (const line of SEASON_SPECIES[season]) {
      for (const card of line) {
        byRarity[card.rarity].push(card);
      }
    }
    result[season] = byRarity;
  }
  return result;
})();
