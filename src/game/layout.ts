// --- Shop interior ---
// Freestanding in the middle of the floor, not flush against the back
// wall — its physics body blocks a straight shot through it, so reaching
// the staff side actually means walking around one end of it.
export const COUNTER_POS = { x: 400, y: 220 };
// The staff-only side, between the counter and the back wall — this is
// where the player has to stand to ring anyone up.
export const COUNTER_BEHIND_POS = { x: 400, y: 165 };
// Where waiting-to-pay customers line up, on the open floor in front of
// the counter — each queue slot stacks further down by REGISTER_QUEUE_SPACING.
export const REGISTER_QUEUE_POS = { x: 400, y: 280 };
export const REGISTER_QUEUE_SPACING = 26;
// Where the player appears after walking in from town — kept well clear of
// SHOP_DOOR_TRIGGER's radius so arriving here can't immediately re-trigger
// the transition back out.
export const SHOP_ENTRANCE_POS = { x: 400, y: 490 };
export const SHOP_DOOR_TRIGGER = { x: 400, y: 585, w: 100, h: 24 };

// --- Distributor interior (order packs/upgrades here — never available
// same-day, and never at the player's own shop counter) ---
export const DISTRIBUTOR_COUNTER_POS = { x: 400, y: 110 };
export const DISTRIBUTOR_ENTRANCE_POS = { x: 400, y: 490 };
export const DISTRIBUTOR_DOOR_TRIGGER = { x: 400, y: 585, w: 100, h: 24 };

// --- General Store interior (adventuring gear: provisions bought here take
// effect on the spot, and it's also where the ranged weapon is unlocked) ---
export const GENERAL_STORE_COUNTER_POS = { x: 400, y: 110 };
export const GENERAL_STORE_ENTRANCE_POS = { x: 400, y: 490 };
export const GENERAL_STORE_DOOR_TRIGGER = { x: 400, y: 585, w: 100, h: 24 };

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

// Distributor's exterior door — on the top wall like the Shop's, but well
// off to the right, clear of Town Hall's footprint. Up and to the right of
// the fountain, so walking out of it means heading down to reach it.
export const TOWN_DISTRIBUTOR_TRIGGER = { x: 750, y: 60 };
export const TOWN_DISTRIBUTOR_DOOR_POS = { x: 750, y: 150 };

// General Store's exterior door — bottom wall, clear of the NPCs' usual
// spots and the Wilds gate on the left wall.
export const TOWN_GENERAL_STORE_TRIGGER = { x: 200, y: 585 };
export const TOWN_GENERAL_STORE_DOOR_POS = { x: 200, y: 490 };

// Only occupied (and only interactable) on the days the traveling merchant
// is actually in town.
export const MERCHANT_CART_POS = { x: 400, y: 460 };

// --- Town <-> Wilds path (left edge of town, clear of the NPC spots) ---
export const TOWN_TO_WILDS_TRIGGER = { x: 36, y: 450 };
export const TOWN_FROM_WILDS_POS = { x: 110, y: 450 };

// --- The Wilds (combat area) ---
export const WILDS_FROM_TOWN_POS = { x: 110, y: 300 };
export const WILDS_TO_TOWN_TRIGGER = { x: 36, y: 300 };
