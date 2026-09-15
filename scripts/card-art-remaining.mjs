#!/usr/bin/env node
// Lists speciesIds that don't have generated art yet under public/card-art/.
// Usage: node scripts/card-art-remaining.mjs [count]   (default: all remaining)

import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artDir = path.join(__dirname, '..', 'public', 'card-art');

const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
const SPECIES_PER_SEASON = 150;

// A species counts as "done" once it has either a generic `<speciesId>.webp`
// or any stage-specific `<speciesId>-<stage>.webp` image.
const done = new Set(
  existsSync(artDir)
    ? readdirSync(artDir)
        .filter((f) => f.endsWith('.webp'))
        .map((f) => f.replace(/\.webp$/, '').replace(/^([A-Za-z]+-\d+)-\d+$/, '$1'))
    : []
);

const all = [];
for (const season of SEASONS) {
  for (let idx = 0; idx < SPECIES_PER_SEASON; idx++) {
    all.push(`${season}-${idx}`);
  }
}

const remaining = all.filter((id) => !done.has(id));
const count = process.argv[2] ? parseInt(process.argv[2], 10) : remaining.length;

console.error(`Progress: ${done.size}/${all.length} species done, ${remaining.length} remaining.`);
for (const id of remaining.slice(0, count)) {
  console.log(id);
}
