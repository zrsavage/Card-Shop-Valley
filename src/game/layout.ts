// --- Shop interior ---
export const COUNTER_POS = { x: 400, y: 110 };
// Where the player appears after walking in from town — kept well clear of
// SHOP_DOOR_TRIGGER's radius so arriving here can't immediately re-trigger
// the transition back out.
export const SHOP_ENTRANCE_POS = { x: 400, y: 490 };
export const SHOP_DOOR_TRIGGER = { x: 400, y: 585, w: 100, h: 24 };

export interface ShelfPosition {
  x: number;
  y: number;
  requires: 'tier1' | 'tier2' | null;
}

// Base six shelves run in two columns along the side walls, leaving a clear
// central corridor from the door to the counter. Upgrade-unlocked shelves
// slot into that corridor closer to the counter without blocking the path
// down the middle (x=400 stays clear of every shelf's footprint).
export const SHOP_SHELF_POSITIONS: ShelfPosition[] = [
  { x: 110, y: 220, requires: null },
  { x: 110, y: 340, requires: null },
  { x: 110, y: 460, requires: null },
  { x: 690, y: 220, requires: null },
  { x: 690, y: 340, requires: null },
  { x: 690, y: 460, requires: null },
  { x: 250, y: 200, requires: 'tier1' },
  { x: 550, y: 200, requires: 'tier1' },
  { x: 250, y: 500, requires: 'tier2' },
  { x: 550, y: 500, requires: 'tier2' },
];

// --- Town square ---
// Same clearance rule as the shop entrance: the arrival point sits well
// outside the trigger's interaction radius so it can't immediately fire again.
export const TOWN_SHOP_DOOR_TRIGGER = { x: 400, y: 60, w: 100, h: 24 };
export const TOWN_SHOP_DOOR_POS = { x: 400, y: 150 };
export const TOWN_HALL_POS = { x: 660, y: 200 };
export const FOUNTAIN_POS = { x: 400, y: 300 };
export const FOUNTAIN_RADIUS = 42;

// --- Town <-> Wilds path (left edge of town, clear of the NPC spots) ---
export const TOWN_TO_WILDS_TRIGGER = { x: 36, y: 450 };
export const TOWN_FROM_WILDS_POS = { x: 110, y: 450 };

// --- The Wilds (combat area) ---
export const WILDS_FROM_TOWN_POS = { x: 110, y: 300 };
export const WILDS_TO_TOWN_TRIGGER = { x: 36, y: 300 };
