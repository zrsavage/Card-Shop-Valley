export interface OutfitDef {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** Recolors the same procedural pixel-art sprite — no new art needed. */
  color: number;
}

// The starting outfit is free and always owned, so there's never a run
// where the player has nothing equipped.
export const OUTFITS: OutfitDef[] = [
  { id: 'default', name: "Adventurer's Vest", description: 'The one you started in.', cost: 0, color: 0xffb703 },
  { id: 'merchant-red', name: "Merchant's Coat", description: 'Sharp and a little showy.', cost: 80, color: 0xc1440e },
  { id: 'forest-green', name: "Ranger's Garb", description: 'Blends right into the Wilds.', cost: 120, color: 0x2d6a4f },
  { id: 'royal-purple', name: 'Noble Attire', description: 'Distinguished. Perhaps too distinguished.', cost: 200, color: 0x6a4c93 },
  { id: 'frost-blue', name: 'Frostback Parka', description: 'Warm enough for the coldest reaches.', cost: 250, color: 0x4fc3f7 },
  { id: 'golden', name: "Legend's Regalia", description: 'For shopkeepers who have truly made it.', cost: 500, color: 0xffd700 },
];
