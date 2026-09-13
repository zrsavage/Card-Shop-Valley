#!/usr/bin/env node
// Deterministically builds an image-generation prompt for one species, so
// every session/run produces the exact same prompt for a given speciesId
// (season-idx) without anyone having to hand-pick a creature/pose/background.
// Usage: node scripts/card-art-prompt.mjs <speciesId>   e.g. Spring-12

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seed) {
  return mulberry32(hashString(seed));
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

const STYLE_LOCK =
  'Traditional hand-painted watercolor and gouache illustration, loose visible brushstrokes, textured paper grain, warm painterly light, storybook style.';

const FRAME_LOCK =
  'contained inside the square frame, no text, no hard border line';

const SEASON_KIT = {
  Spring: {
    flavor: 'made of budding leaves, moss, and pink or white petals',
    archetypes: ['fawn', 'rabbit', 'fox kit', 'small owl', 'field mouse', 'baby goat', 'songbird', 'turtle', 'lamb', 'squirrel'],
    poses: [
      'bounding forward mid-leap through tall grass',
      'perched and about to spring off a mossy log',
      'twisting back over its shoulder mid-turn',
      'rearing up on its hind legs, startled and alert',
      'sprinting low with ears back',
      'peeking out from behind a cluster of ferns',
      'shaking petals off after a light rain',
      'balancing on a swaying flower stem',
    ],
    backgrounds: [
      'a sunlit spring meadow with drifting petals',
      'a mossy forest clearing with soft dappled light',
      'a hillside dotted with wildflowers',
      'the edge of a gently flowing stream',
      'a garden path lined with blossoming shrubs',
      'a sunbeam breaking through young forest canopy',
    ],
  },
  Summer: {
    flavor: 'made of ember-orange and gold flame, or sun-warmed fur and feathers',
    archetypes: ['flame bird', 'young fox', 'lizard', 'wildcat cub', 'firefly sprite', 'young ram', 'hawk chick', 'salamander', 'desert hare', 'ember wolf pup'],
    poses: [
      'crouched low and coiled, about to pounce',
      'skidding to a stop, sparks or dust flying up',
      'leaping across a gap mid-air',
      'rearing back with a fierce, determined look',
      'sprinting flat-out across open ground',
      'perched on a sunbaked rock, wings or tail flared',
      'twisting mid-turn to look back at the viewer',
      'climbing up onto a ledge, muscles tensed',
    ],
    backgrounds: [
      'a warm golden sky at high noon',
      'a cracked sunbaked rock ledge with heat shimmer',
      'a dry grass field under a blazing sun',
      'a dusty canyon trail',
      'a smoldering volcanic ledge with faint smoke',
      'a beach dune at sunset',
    ],
  },
  Fall: {
    flavor: 'made of bark, moss, and fallen autumn leaves in orange, brown, and gold',
    archetypes: ['wood golem', 'badger', 'owl', 'squirrel', 'young boar', 'raccoon', 'hedgehog', 'crow chick', 'stag fawn', 'toad'],
    poses: [
      'trudging forward through a pile of crunching leaves',
      'perched on a stump, head tilted curiously',
      'startled mid-step, leaves scattering around it',
      'climbing over a fallen log',
      'shaking loose leaves off its back',
      'peering out from a hollow in a tree trunk',
      'mid-stride along a winding forest path',
      'rearing back among tall dry grass',
    ],
    backgrounds: [
      'a forest floor blanketed in fallen leaves',
      'a misty autumn woodland at dusk',
      'a harvest field with hay bales in the distance',
      'a mossy hollow beneath old tree roots',
      'a rustic stone wall overgrown with vines',
      'a quiet orchard with a few late apples',
    ],
  },
  Winter: {
    flavor: 'made of pale frost, snow, and icicle wisps',
    archetypes: ['ice spirit', 'snow fox', 'young yeti', 'penguin chick', 'arctic hare', 'reindeer fawn', 'snowy owl', 'seal pup', 'frost wolf pup', 'winter sprite'],
    poses: [
      'bounding through deep snow, leaving fresh tracks',
      'sliding across a frozen pond, off balance',
      'perched atop a snowdrift, fur or frost ruffled by wind',
      'curled up shivering, then glancing up alertly',
      'leaping between two ice-covered rocks',
      'shaking snow off after a tumble',
      'peeking out from behind an icicle-draped branch',
      'rearing back against a gust of blowing snow',
    ],
    backgrounds: [
      'a snowy pine forest under a pale sky',
      'a frozen lake edge with drifting snowflakes',
      'a icy mountainside with soft aurora light',
      'a quiet snowdrift at dusk',
      'a frost-covered clearing with bare trees',
      'a gentle snowfall over a frozen stream',
    ],
  },
};

function buildPrompt(speciesId) {
  const [season] = speciesId.split('-');
  const kit = SEASON_KIT[season];
  if (!kit) throw new Error(`Unknown season in speciesId "${speciesId}"`);
  const rand = seededRandom(speciesId);
  const archetype = pick(rand, kit.archetypes);
  const pose = pick(rand, kit.poses);
  const background = pick(rand, kit.backgrounds);
  return (
    `${STYLE_LOCK} A small whimsical ${archetype} creature, ${kit.flavor}, ` +
    `${pose}. Background: ${background}, ${FRAME_LOCK}`
  );
}

const speciesId = process.argv[2];
if (!speciesId) {
  console.error('Usage: node scripts/card-art-prompt.mjs <speciesId>');
  process.exit(1);
}
console.log(buildPrompt(speciesId));
