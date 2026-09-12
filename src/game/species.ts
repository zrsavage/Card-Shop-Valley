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

interface SeasonVocab {
  adjectives: string[];
  nouns: string[];
  /** Prefix applied for stage 2, 3, 4 respectively (stage 1 has none, stage 5 uses legendaryEpithet). */
  stageTitles: [string, string, string];
  legendaryEpithet: string;
}

const VOCAB: Record<Season, SeasonVocab> = {
  Spring: {
    adjectives: [
      'Dew', 'Moss', 'Bramble', 'Petal', 'Sprout', 'Clover', 'Meadow', 'Blossom', 'Fern', 'Willow',
      'Thistle', 'Honey', 'Pollen', 'Vernal', 'Budding', 'Verdant', 'Mossy', 'Lush', 'Sunlit', 'Tender',
      'Dappled', 'Wildflower', 'Sprig', 'Rootling', 'Meadowlark',
    ],
    nouns: [
      'Fox', 'Hare', 'Sparrow', 'Beetle', 'Turtle', 'Fawn', 'Owlet', 'Vole', 'Badger', 'Wren',
      'Squirrel', 'Toad', 'Hedgehog', 'Finch', 'Newt', 'Moth', 'Rabbit', 'Mole', 'Lamb', 'Kit',
      'Pixie', 'Sprite', 'Wisp', 'Nymph', 'Dryad', 'Griffin', 'Wyrm', 'Phoenix', 'Sphinx', 'Drake',
    ],
    stageTitles: ['Blooming', 'Elder', 'Ancient'],
    legendaryEpithet: 'the Everblooming Sovereign',
  },
  Summer: {
    adjectives: [
      'Sun', 'Sand', 'Tide', 'Coral', 'Reef', 'Palm', 'Dune', 'Blaze', 'Ember', 'Molten',
      'Mirage', 'Cyclone', 'Amber', 'Solstice', 'Scorched', 'Glimmer', 'Rippling', 'Salt', 'Driftwood', 'Radiant',
      'Torrid', 'Sizzling', 'Wavecrest', 'Sunbaked', 'Heatwave',
    ],
    nouns: [
      'Skink', 'Crab', 'Minnow', 'Sprite', 'Beetle', 'Golem', 'Salamander', 'Ray', 'Jackal', 'Hawk',
      'Serpent', 'Lionfish', 'Roc', 'Drake', 'Sphinx', 'Turtle', 'Iguana', 'Pelican', 'Scorpion', 'Gull',
      'Heron', 'Anemone', 'Barracuda', 'Falcon', 'Viper', 'Djinn', 'Phoenix', 'Leviathan', 'Kraken', 'Wyrm',
    ],
    stageTitles: ['Blazing', 'Searing', 'Ancient'],
    legendaryEpithet: 'the Sunfire Sovereign',
  },
  Fall: {
    adjectives: [
      'Acorn', 'Pumpkin', 'Harvest', 'Rustling', 'Amber', 'Maple', 'Cider', 'Withering', 'Chestnut', 'Bloodmoon',
      'Rotwood', 'Harvestwind', 'Autumn', 'Withered', 'Stormcrow', 'Coppery', 'Bramblewood', 'Gourdling', 'Mistfall', 'Driftleaf',
      'Hollow', 'Mellow', 'Spiced', 'Russet', 'Fading',
    ],
    nouns: [
      'Squirrel', 'Sprite', 'Mouse', 'Owlet', 'Beetle', 'Wisp', 'Fox', 'Boar', 'Wraith', 'Golem',
      'Hawk', 'Stag', 'Treant', 'Wyrm', 'Griffin', 'Reaper', 'Crow', 'Raven', 'Spider', 'Serpent',
      'Moth', 'Bat', 'Toad', 'Newt', 'Weasel', 'Badger', 'Phoenix', 'Djinn', 'Dragon', 'Sphinx',
    ],
    stageTitles: ['Withered', 'Elder', 'Ancient'],
    legendaryEpithet: 'the Harvestbound Sovereign',
  },
  Winter: {
    adjectives: [
      'Frost', 'Snow', 'Icicle', 'Glacier', 'Blizzard', 'Rime', 'Frostbite', 'Permafrost', 'Aurora', 'Powder',
      'Sleet', 'Hoarfrost', 'Icebound', 'Boreal', 'Frozen', 'Crystalline', 'Pale', 'Drift', 'Glacial', 'Whiteout',
      'Icefall', 'Windchill', 'Snowbound', 'Numbing', 'Silvered',
    ],
    nouns: [
      'Vole', 'Hare', 'Sprite', 'Marten', 'Beetle', 'Golem', 'Fox', 'Owl', 'Wolf', 'Hawk',
      'Turtle', 'Wyrm', 'Griffin', 'Stag', 'Serpent', 'Yeti', 'Kraken', 'Djinn', 'Dragon', 'Sphinx',
      'Weasel', 'Ermine', 'Lynx', 'Ptarmigan', 'Seal', 'Narwhal', 'Raven', 'Bear', 'Elk', 'Wisp',
    ],
    stageTitles: ['Rimed', 'Elder', 'Ancient'],
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

function buildStageNames(vocab: SeasonVocab, adj: string, noun: string, stageCount: number): string[] {
  const names: string[] = [`${adj} ${noun}`];
  for (let stage = 2; stage <= stageCount; stage++) {
    if (stage === 5) {
      names.push(`${names[stage - 2]}, ${vocab.legendaryEpithet}`);
    } else {
      names.push(`${vocab.stageTitles[stage - 2]} ${adj} ${noun}`);
    }
  }
  return names;
}

function buildSeasonSpecies(season: Season): SpeciesCard[][] {
  const vocab = VOCAB[season];
  const rand = seededRandom(`species-seed-${season}`);

  const pairs: [string, string][] = [];
  for (const adj of vocab.adjectives) {
    for (const noun of vocab.nouns) {
      pairs.push([adj, noun]);
    }
  }
  // Deterministic Fisher-Yates shuffle, then take the first SPECIES_PER_SEASON pairs.
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const chosen = pairs.slice(0, SPECIES_PER_SEASON);

  return chosen.map(([adj, noun], idx) => {
    const roll = rand();
    const stageCount = roll < 0.1 ? 5 : roll < 0.3 ? 4 : 3;
    const speciesId = `${season}-${idx}`;
    const names = buildStageNames(vocab, adj, noun, stageCount);
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
