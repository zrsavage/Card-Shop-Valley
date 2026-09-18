export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Card {
  id: string;
  name: string;
  rarity: Rarity;
  baseValue: number;
  color: number;
  season: Season;
  /** Evolution line this card belongs to — same speciesId across all its stages. */
  speciesId: string;
  /** 1-indexed evolution stage (1 = base form). */
  stage: number;
  /** Total number of stages in this card's evolution line, for "Stage 2/3" display. */
  stageCount: number;
  /** A rare alternate-look version of the same card, worth much more. */
  shiny: boolean;
}

export interface ShelfSlot {
  id: string;
  card: Card | null;
  price: number;
}

export type Season = 'Spring' | 'Summer' | 'Fall' | 'Winter';

export interface ShopUpgrades {
  extraShelvesTier1: boolean;
  extraShelvesTier2: boolean;
  marketingSign: boolean;
  appraisersLoupe: boolean;
  bagTier1: boolean;
  bagTier2: boolean;
  /** Staff — automate parts of the shop loop so it keeps ticking over
   * while you're off in the Wilds, fishing, or talking to townsfolk. */
  shopClerk: boolean;
  autoRestocker: boolean;
}

export interface TownUpgrades {
  fountainRepaired: boolean;
  festivalsUnlocked: boolean;
}

/** Weekly bills — a real cost of living on top of running the shop. Each
 * flag is true once that specific fee has been permanently paid off at
 * Town Hall, so it never comes out of the weekly total again. */
export interface RecurringFees {
  rentWaived: boolean;
  processingFeeWaived: boolean;
  mailInFeeWaived: boolean;
  taxFeeWaived: boolean;
}

export interface CombatUpgrades {
  weaponTier1: boolean;
  weaponTier2: boolean;
  weaponTier3: boolean;
  weaponTier4: boolean;
  weaponTier5: boolean;
  vitalityTier1: boolean;
  vitalityTier2: boolean;
  vitalityTier3: boolean;
  vitalityTier4: boolean;
  vitalityTier5: boolean;
  /** Longer AND wider melee reach — a directional cone in front of the
   * player rather than a flat stat like the tiers above. */
  attackRangeTier1: boolean;
  attackRangeTier2: boolean;
  /** Unlocks the alternate ranged attack (General Store) — a slow, heavy-
   * hitting thrown/fired option alongside the default melee swing. */
  rangedWeaponUnlocked: boolean;
  /** Ranged upgrades: more damage AND a shorter wind-up per tier — the
   * weapon hits harder and gets less punishing to use as you invest in it. */
  rangedTier1: boolean;
  rangedTier2: boolean;
}

export interface MovementUpgrades {
  speedTier1: boolean;
  speedTier2: boolean;
  speedTier3: boolean;
  speedTier4: boolean;
}

/** What an NPC currently wants gifted — season + rarity, not a specific
 * card, so it's a real target without being frustratingly narrow. */
export interface CardRequest {
  season: Season;
  rarity: Rarity;
}

export interface NpcState {
  friendship: number;
  lastTalkedDay: number;
  request: CardRequest | null;
}

/** A daily Town Board objective — tracked against a same-day counter on
 * gameState, rerolled fresh (unclaimed rewards lost) whenever the day ends. */
export interface BoardObjective {
  id: string;
  description: string;
  metric: 'cardsSold' | 'enemiesDefeated' | 'giftsGiven' | 'packsOpened' | 'goldEarned' | 'fishCaught';
  target: number;
  reward: number;
  claimed: boolean;
}

export type MerchantOfferKind = 'rareBundle' | 'shinyCharm' | 'mythicCloseout';

export interface MerchantOffer {
  id: string;
  kind: MerchantOfferKind;
  name: string;
  description: string;
  cost: number;
  purchased: boolean;
}

export interface MerchantVisit {
  day: number;
  offers: MerchantOffer[];
}
