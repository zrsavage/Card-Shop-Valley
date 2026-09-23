# Background music

Drop real tracks in here with these exact filenames and they take over
automatically — no code changes needed. Until a file exists, that scene
falls back to a generated ambient loop (see `src/game/music.ts`).

| File                     | Scene         | Mood to aim for |
|--------------------------|---------------|------------------|
| `shop.mp3`               | Shop          | Warm, unhurried, cozy — a calm place to run a counter. |
| `town.mp3`               | Town          | Bright, open, a little livelier — a lived-in square. |
| `wilds.mp3`              | Wilds         | Sparse, minor-key, watchful — not full "combat" intensity, more tension/mystery. |
| `distributor.mp3`        | Distributor   | Business-like, a bit brisk — counting inventory. |
| `general-store.mp3`      | General Store | Airy, bright, daylight sundries-shop feel. |

Requirements:
- **Format:** `.mp3` (played via a looping HTML5 `<audio>` element).
- **Loopable:** no hard silence or a jarring cut at the seam — the game
  sets `loop = true` and lets the browser handle the wrap, so the track's
  own start/end need to flow into each other reasonably cleanly.
- **Length:** doesn't matter much since it loops — 1–3 minutes is a normal
  ambient-loop length, long enough not to feel repetitive.
- **Licensing:** make sure whatever you use is actually cleared for this —
  royalty-free/CC0, a paid license that permits use in a game, or something
  you generated/composed yourself. Don't drop in something you only have a
  personal-listening right to.

Once a file is added, it plays instead of the generated loop the very next
time that scene loads — nothing else needs to change.
