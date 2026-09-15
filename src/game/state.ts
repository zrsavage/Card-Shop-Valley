import Phaser from 'phaser';
import type {
  Card,
  ShelfSlot,
  Season,
  ShopUpgrades,
  TownUpgrades,
  CombatUpgrades,
  MovementUpgrades,
  NpcState,
  CardRequest,
  Rarity,
  BoardObjective,
  MerchantVisit,
} from './types';
import { SHOP_SHELF_POSITIONS } from './layout';
import { NPCS } from './npcs';
import { RARITIES, generateCard } from './cards';
import { SEASON_CARD_POOL } from './species';
import { rollTownBoard } from './townBoard';
import { rollMerchantOffers, MERCHANT_VISIT_CHANCE } from './merchant';
import { PRESTIGE_PERKS } from './prestige';
import { OUTFITS } from './outfits';
import { rollFish, FISHING_ENERGY_COST, type FishDef } from './fishing';
import { DECOR_ITEMS } from './decor';

export const bus = new Phaser.Events.EventEmitter();

export const SHELF_COUNT = SHOP_SHELF_POSITIONS.length;
export const DAYS_PER_SEASON = 7;
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];

export const PLAYER_BASE_ATTACK_DAMAGE = 14;
export const WEAPON_TIER_DAMAGE_BONUS = 6;
export const PLAYER_BASE_MAX_HP = 100;
export const VITALITY_TIER_HP_BONUS = 40;

export const PLAYER_BASE_SPEED = 240;
export const SPEED_TIER_BONUS = 30;

export const PLAYER_MAX_ENERGY = 100;
// Passive drain: a full day's energy (idling in Town/Shop) lasts ~5 minutes.
export const ENERGY_DRAIN_PER_SEC = PLAYER_MAX_ENERGY / 300;
// On top of the passive drain, active on top while in the Wilds — burns
// through energy roughly 4x faster than just standing around.
export const WILDS_EXTRA_ENERGY_DRAIN_PER_SEC = ENERGY_DRAIN_PER_SEC * 3;
// Exhausted (0 energy): the player is "practically defenseless" in combat.
export const EXHAUSTED_ATTACK_DAMAGE = 1;
export const EXHAUSTED_SPEED_MULTIPLIER = 0.4;
export const EXHAUSTED_DAMAGE_TAKEN_MULTIPLIER = 1.6;

export const BAG_BASE_CAPACITY = 12;
export const BAG_TIER_CAPACITY_BONUS = 8;

export const ENERGY_TONIC_COST = 30;
export const ENERGY_TONIC_RESTORE = 40;

// Shop reputation — derived from lifetime sales, not stored directly, so it
// only ever grows and can't be gamed by a save/reload. Higher tiers unlock
// customer archetypes beyond the default browse-or-buy visitor.
export interface ReputationTier {
  minSales: number;
  name: string;
  spawnMultiplier: number;
  bulkBuyerChance: number;
  bigSpenderChance: number;
}

export const REPUTATION_TIERS: ReputationTier[] = [
  { minSales: 0, name: 'Newcomer', spawnMultiplier: 1, bulkBuyerChance: 0, bigSpenderChance: 0 },
  { minSales: 15, name: 'Known in Town', spawnMultiplier: 1.15, bulkBuyerChance: 0.15, bigSpenderChance: 0 },
  { minSales: 50, name: 'Trusted Shop', spawnMultiplier: 1.3, bulkBuyerChance: 0.3, bigSpenderChance: 0.15 },
  { minSales: 120, name: 'Renowned', spawnMultiplier: 1.5, bulkBuyerChance: 0.4, bigSpenderChance: 0.3 },
];

// Requests skew toward the lower rarities so they're a real, reachable
// target most of the time rather than a demand to farm a legendary.
const REQUEST_RARITY_WEIGHTS: Record<Rarity, number> = { common: 40, uncommon: 30, rare: 20, epic: 8, legendary: 2 };

function rollNpcRequest(): CardRequest {
  const season = SEASONS[Math.floor(Math.random() * SEASONS.length)];
  const entries = Object.entries(REQUEST_RARITY_WEIGHTS) as [Rarity, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  let rarity: Rarity = 'common';
  for (const [r, w] of entries) {
    if (roll < w) {
      rarity = r;
      break;
    }
    roll -= w;
  }
  return { season, rarity };
}

export interface DaySummary {
  day: number;
  season: Season;
  goldEarned: number;
  cardsSold: number;
  packsArrived: number;
}

function defaultShopUpgrades(): ShopUpgrades {
  return {
    extraShelvesTier1: false,
    extraShelvesTier2: false,
    marketingSign: false,
    appraisersLoupe: false,
    bagTier1: false,
    bagTier2: false,
  };
}

function defaultTownUpgrades(): TownUpgrades {
  return {
    fountainRepaired: false,
    festivalsUnlocked: false,
  };
}

function defaultCombatUpgrades(): CombatUpgrades {
  return {
    weaponTier1: false,
    weaponTier2: false,
    weaponTier3: false,
    weaponTier4: false,
    weaponTier5: false,
    vitalityTier1: false,
    vitalityTier2: false,
    vitalityTier3: false,
    vitalityTier4: false,
    vitalityTier5: false,
  };
}

function defaultMovementUpgrades(): MovementUpgrades {
  return {
    speedTier1: false,
    speedTier2: false,
    speedTier3: false,
    speedTier4: false,
  };
}

function defaultNpcStates(): Record<string, NpcState> {
  const record: Record<string, NpcState> = {};
  for (const npc of NPCS) {
    record[npc.id] = { friendship: 0, lastTalkedDay: 0, request: rollNpcRequest() };
  }
  return record;
}

class GameState {
  gold = 100;
  day = 1;
  inventory: Card[] = [];
  shelves: ShelfSlot[] = SHOP_SHELF_POSITIONS.map((_, i) => ({
    id: `shelf-${i}`,
    card: null,
    price: 0,
  }));

  shopUpgrades: ShopUpgrades = defaultShopUpgrades();
  townUpgrades: TownUpgrades = defaultTownUpgrades();
  combatUpgrades: CombatUpgrades = defaultCombatUpgrades();
  movementUpgrades: MovementUpgrades = defaultMovementUpgrades();
  npcs: Record<string, NpcState> = defaultNpcStates();

  /** Cosmetic only — never touched by prestige, unlike the upgrade fields
   * above. The starting outfit is free and always owned. */
  ownedOutfits: string[] = ['default'];
  equippedOutfitId = 'default';
  ownedDecor: string[] = [];

  paused = false;
  goldEarnedToday = 0;
  cardsSoldToday = 0;
  /** Never decreases — the long-run stats behind the Legacy milestones,
   * independent of how much gold or how many cards you currently have. */
  lifetimeGoldEarned = 0;
  lifetimeCardsSold = 0;
  /** Every distinct card (speciesId + stage — each evolution stage is its
   * own name/rarity) ever obtained, regardless of whether it's since been
   * sold, gifted, or shelved — the Encyclopedia's "discovered" set. */
  discoveredCards = new Set<string>();

  enemiesDefeatedToday = 0;
  giftsGivenToday = 0;
  packsOpenedToday = 0;
  fishCaughtToday = 0;

  /** Lifetime count of each fish species caught at the fountain — the Fish
   * Codex's "discovered" set, and survives prestige like the card
   * Encyclopedia does. */
  fishCaught: Record<string, number> = {};
  lifetimeFishCaught = 0;

  /** Daily objectives posted at the Town Hall — rerolled (unclaimed rewards
   * lost) every time the day ends. */
  townBoard: BoardObjective[] = rollTownBoard(false);

  /** Set (with rolled offers) only on the days the traveling merchant is
   * actually in town — null the rest of the time. */
  merchantVisit: MerchantVisit | null = null;
  /** Consumed by the next pack opened, guaranteeing it includes a shiny. */
  shinyCharmActive = false;

  /** How many times the player has prestiged after reaching the Legacy
   * capstone — resets most progress but keeps the encyclopedia and lifetime
   * stats, in exchange for a permanent, stacking perk. */
  prestigeLevel = 0;
  prestigePerks: string[] = [];

  hp = PLAYER_BASE_MAX_HP;
  energy = PLAYER_MAX_ENERGY;
  /** Pack ids ready to open now — from combat drops (same day) or a
   * purchase placed on a previous day. */
  ownedPacks: string[] = [];
  /** Pack ids bought today — a purchase is an overnight order, not an
   * instant open, so there's a reason to go do something else with today's
   * energy instead of just cycling packs at the counter. */
  pendingPacks: string[] = [];

  /** Always includes 'bramble', the free starting zone. */
  unlockedZones: string[] = ['bramble'];
  currentZoneId = 'bramble';

  get season(): Season {
    return SEASONS[Math.floor((this.day - 1) / DAYS_PER_SEASON) % SEASONS.length];
  }

  get isFestivalDay(): boolean {
    return this.townUpgrades.festivalsUnlocked && this.day % 7 === 0;
  }

  get attackDamage(): number {
    // Running on empty overrides upgrades entirely — exhaustion means
    // "practically defenseless," not just "a bit weaker."
    if (this.isExhausted) return EXHAUSTED_ATTACK_DAMAGE;
    const tiers = [
      this.combatUpgrades.weaponTier1,
      this.combatUpgrades.weaponTier2,
      this.combatUpgrades.weaponTier3,
      this.combatUpgrades.weaponTier4,
      this.combatUpgrades.weaponTier5,
    ].filter(Boolean).length;
    const base = PLAYER_BASE_ATTACK_DAMAGE + tiers * WEAPON_TIER_DAMAGE_BONUS;
    const ironGripTiers = this.prestigePerks.filter((p) => p === 'ironGrip').length;
    return Math.round(base * (1 + ironGripTiers * 0.1));
  }

  get maxHp(): number {
    const tiers = [
      this.combatUpgrades.vitalityTier1,
      this.combatUpgrades.vitalityTier2,
      this.combatUpgrades.vitalityTier3,
      this.combatUpgrades.vitalityTier4,
      this.combatUpgrades.vitalityTier5,
    ].filter(Boolean).length;
    return PLAYER_BASE_MAX_HP + tiers * VITALITY_TIER_HP_BONUS;
  }

  get maxEnergy(): number {
    return PLAYER_MAX_ENERGY;
  }

  get isExhausted(): boolean {
    return this.energy <= 0;
  }

  get moveSpeed(): number {
    const tiers = [
      this.movementUpgrades.speedTier1,
      this.movementUpgrades.speedTier2,
      this.movementUpgrades.speedTier3,
      this.movementUpgrades.speedTier4,
    ].filter(Boolean).length;
    return PLAYER_BASE_SPEED + tiers * SPEED_TIER_BONUS;
  }

  get equippedOutfitColor(): number {
    return (OUTFITS.find((o) => o.id === this.equippedOutfitId) ?? OUTFITS[0]).color;
  }

  get bagCapacity(): number {
    const tiers = [this.shopUpgrades.bagTier1, this.shopUpgrades.bagTier2].filter(Boolean).length;
    const packRatTiers = this.prestigePerks.filter((p) => p === 'packRat').length;
    return BAG_BASE_CAPACITY + tiers * BAG_TIER_CAPACITY_BONUS + packRatTiers * 6;
  }

  hasBagSpace(count: number): boolean {
    return this.inventory.length + count <= this.bagCapacity;
  }

  get reputationTier(): ReputationTier {
    let tier = REPUTATION_TIERS[0];
    for (const t of REPUTATION_TIERS) {
      if (this.lifetimeCardsSold >= t.minSales) tier = t;
    }
    return tier;
  }

  get nextReputationTier(): ReputationTier | null {
    const idx = REPUTATION_TIERS.indexOf(this.reputationTier);
    return REPUTATION_TIERS[idx + 1] ?? null;
  }

  /** Days including today before the current season's card set rotates
   * out — 0 means today is the last day. */
  get daysLeftInSeason(): number {
    const posInSeason = (this.day - 1) % DAYS_PER_SEASON;
    return DAYS_PER_SEASON - posInSeason - 1;
  }

  /** Seasons where every card (every stage of every species) has been
   * discovered at least once — a real payoff for finishing the Encyclopedia. */
  get completedSeasons(): Season[] {
    return SEASONS.filter((season) => {
      let total = 0;
      let discovered = 0;
      for (const rarity of RARITIES) {
        for (const c of SEASON_CARD_POOL[season][rarity]) {
          total += 1;
          if (this.discoveredCards.has(`${c.speciesId}:${c.stage}`)) discovered += 1;
        }
      }
      return total > 0 && discovered >= total;
    });
  }

  /** Combined bonus applied to shop sale prices: prestige's Golden Touch
   * perk plus a small permanent bump per fully-discovered season. */
  get saleGoldMultiplier(): number {
    const goldenTouchTiers = this.prestigePerks.filter((p) => p === 'goldenTouch').length;
    return 1 + goldenTouchTiers * 0.1 + this.completedSeasons.length * 0.05;
  }

  addGold(amount: number) {
    this.gold += amount;
    if (amount > 0) this.lifetimeGoldEarned += amount;
    bus.emit('gold-changed', this.gold);
  }

  spendGold(amount: number): boolean {
    if (this.gold < amount) return false;
    this.gold -= amount;
    bus.emit('gold-changed', this.gold);
    return true;
  }

  addCardsToInventory(cards: Card[]) {
    this.inventory.push(...cards);
    let discoveredSomethingNew = false;
    for (const card of cards) {
      const key = `${card.speciesId}:${card.stage}`;
      if (!this.discoveredCards.has(key)) {
        this.discoveredCards.add(key);
        discoveredSomethingNew = true;
      }
    }
    bus.emit('inventory-changed', this.inventory);
    if (discoveredSomethingNew) bus.emit('cards-discovered', this.discoveredCards);
  }

  removeFromInventory(cardId: string): Card | null {
    const idx = this.inventory.findIndex((c) => c.id === cardId);
    if (idx < 0) return null;
    const [card] = this.inventory.splice(idx, 1);
    bus.emit('inventory-changed', this.inventory);
    return card;
  }

  placeOnShelf(shelfId: string, cardId: string, price: number): boolean {
    const shelf = this.shelves.find((s) => s.id === shelfId);
    if (!shelf || shelf.card) return false;
    const card = this.removeFromInventory(cardId);
    if (!card) return false;
    shelf.card = card;
    shelf.price = Math.max(1, Math.round(price));
    bus.emit('shelves-changed', this.shelves);
    return true;
  }

  clearShelf(shelfId: string) {
    const shelf = this.shelves.find((s) => s.id === shelfId);
    if (!shelf || !shelf.card) return;
    this.addCardsToInventory([shelf.card]);
    shelf.card = null;
    shelf.price = 0;
    bus.emit('shelves-changed', this.shelves);
  }

  repriceShelf(shelfId: string, price: number) {
    const shelf = this.shelves.find((s) => s.id === shelfId);
    if (!shelf || !shelf.card) return;
    shelf.price = Math.max(1, Math.round(price));
    bus.emit('shelves-changed', this.shelves);
  }

  sellFromShelf(shelfId: string): number {
    const shelf = this.shelves.find((s) => s.id === shelfId);
    if (!shelf || !shelf.card) return 0;
    const earned = Math.round(shelf.price * this.saleGoldMultiplier);
    shelf.card = null;
    shelf.price = 0;
    this.addGold(earned);
    this.goldEarnedToday += earned;
    this.cardsSoldToday += 1;
    this.lifetimeCardsSold += 1;
    bus.emit('shelves-changed', this.shelves);
    bus.emit('board-progress-changed');
    return earned;
  }

  purchaseShopUpgrade(key: keyof ShopUpgrades, cost: number): boolean {
    if (this.shopUpgrades[key]) return false;
    if (!this.spendGold(cost)) return false;
    this.shopUpgrades[key] = true;
    bus.emit('shop-upgrades-changed', this.shopUpgrades);
    return true;
  }

  purchaseTownUpgrade(key: keyof TownUpgrades, cost: number): boolean {
    if (this.townUpgrades[key]) return false;
    if (!this.spendGold(cost)) return false;
    this.townUpgrades[key] = true;
    bus.emit('town-upgrades-changed', this.townUpgrades);
    return true;
  }

  purchaseCombatUpgrade(key: keyof CombatUpgrades, cost: number): boolean {
    if (this.combatUpgrades[key]) return false;
    if (!this.spendGold(cost)) return false;
    this.combatUpgrades[key] = true;
    if (key.startsWith('vitality')) {
      // maxHp is derived from combatUpgrades, so it's already gone up by
      // the time we read it here — top the player off by the same amount
      // rather than fully healing, so a mid-fight purchase still means
      // something changed the same instant it was bought.
      this.hp = Math.min(this.maxHp, this.hp + VITALITY_TIER_HP_BONUS);
      bus.emit('hp-changed', this.hp);
    }
    bus.emit('combat-upgrades-changed', this.combatUpgrades);
    return true;
  }

  purchaseMovementUpgrade(key: keyof MovementUpgrades, cost: number): boolean {
    if (this.movementUpgrades[key]) return false;
    if (!this.spendGold(cost)) return false;
    this.movementUpgrades[key] = true;
    bus.emit('movement-upgrades-changed', this.movementUpgrades);
    return true;
  }

  purchaseOutfit(id: string, cost: number): boolean {
    if (!OUTFITS.some((o) => o.id === id)) return false;
    if (this.ownedOutfits.includes(id)) return false;
    if (!this.spendGold(cost)) return false;
    this.ownedOutfits.push(id);
    bus.emit('cosmetics-changed');
    return true;
  }

  equipOutfit(id: string): boolean {
    if (!this.ownedOutfits.includes(id)) return false;
    this.equippedOutfitId = id;
    bus.emit('cosmetics-changed');
    return true;
  }

  purchaseDecor(id: string, cost: number): boolean {
    if (!DECOR_ITEMS.some((d) => d.id === id)) return false;
    if (this.ownedDecor.includes(id)) return false;
    if (!this.spendGold(cost)) return false;
    this.ownedDecor.push(id);
    bus.emit('cosmetics-changed');
    return true;
  }

  unlockZone(zoneId: string, cost: number): boolean {
    if (this.unlockedZones.includes(zoneId)) return false;
    if (!this.spendGold(cost)) return false;
    this.unlockedZones.push(zoneId);
    bus.emit('zones-changed', this.unlockedZones);
    return true;
  }

  travelToZone(zoneId: string): boolean {
    if (!this.unlockedZones.includes(zoneId)) return false;
    this.currentZoneId = zoneId;
    bus.emit('zone-changed', zoneId);
    return true;
  }

  talkToNpc(npcId: string): { alreadyTalkedToday: boolean; gain: number } {
    const npc = this.npcs[npcId];
    if (npc.lastTalkedDay === this.day) return { alreadyTalkedToday: true, gain: 0 };
    const gain = this.townUpgrades.fountainRepaired ? 3 : 2;
    npc.friendship = Math.min(100, npc.friendship + gain);
    npc.lastTalkedDay = this.day;
    bus.emit('npc-changed', npcId);
    return { alreadyTalkedToday: false, gain };
  }

  giftCardToNpc(npcId: string, cardId: string): { friendshipGain: number; goldGain: number; matchedRequest: boolean } {
    const card = this.removeFromInventory(cardId);
    if (!card) return { friendshipGain: 0, goldGain: 0, matchedRequest: false };
    const npc = this.npcs[npcId];
    const matchedRequest = !!npc.request && npc.request.season === card.season && npc.request.rarity === card.rarity;

    const friendshipGain = matchedRequest ? Math.max(8, Math.round(card.baseValue / 4) * 3) : Math.max(2, Math.round(card.baseValue / 4));
    const goldGain = matchedRequest ? card.baseValue * 2 : 0;

    npc.friendship = Math.min(100, npc.friendship + friendshipGain);
    if (matchedRequest) {
      this.addGold(goldGain);
      npc.request = rollNpcRequest();
    }
    this.giftsGivenToday += 1;
    bus.emit('npc-changed', npcId);
    bus.emit('board-progress-changed');
    return { friendshipGain, goldGain, matchedRequest };
  }

  /** Called by the Wilds scene on every kill, regular or boss. */
  noteEnemyDefeated() {
    this.enemiesDefeatedToday += 1;
    bus.emit('board-progress-changed');
  }

  /** Called right after a pack is opened, before its cards are added. */
  notePackOpened() {
    this.packsOpenedToday += 1;
    bus.emit('board-progress-changed');
  }

  private boardMetricValue(metric: BoardObjective['metric']): number {
    switch (metric) {
      case 'cardsSold':
        return this.cardsSoldToday;
      case 'enemiesDefeated':
        return this.enemiesDefeatedToday;
      case 'giftsGiven':
        return this.giftsGivenToday;
      case 'packsOpened':
        return this.packsOpenedToday;
      case 'goldEarned':
        return this.goldEarnedToday;
      case 'fishCaught':
        return this.fishCaughtToday;
    }
  }

  boardObjectiveProgress(obj: BoardObjective): number {
    return this.boardMetricValue(obj.metric);
  }

  claimBoardObjective(id: string): boolean {
    const obj = this.townBoard.find((o) => o.id === id);
    if (!obj || obj.claimed) return false;
    if (this.boardMetricValue(obj.metric) < obj.target) return false;
    obj.claimed = true;
    this.addGold(obj.reward);
    bus.emit('town-board-changed', this.townBoard);
    return true;
  }

  /** Consumes the active shiny charm, if any — the caller uses the return
   * value to force one card in the pack it's about to open. */
  consumeShinyCharm(): boolean {
    if (!this.shinyCharmActive) return false;
    this.shinyCharmActive = false;
    return true;
  }

  buyMerchantOffer(offerId: string): boolean {
    if (!this.merchantVisit || this.merchantVisit.day !== this.day) return false;
    const offer = this.merchantVisit.offers.find((o) => o.id === offerId);
    if (!offer || offer.purchased) return false;
    if (!this.spendGold(offer.cost)) return false;
    offer.purchased = true;

    if (offer.kind === 'rareBundle') {
      const weights: [Rarity, number][] = [
        ['rare', 55],
        ['epic', 35],
        ['legendary', 10],
      ];
      const total = weights.reduce((sum, [, w]) => sum + w, 0);
      const cards: Card[] = [];
      for (let i = 0; i < 3; i++) {
        let roll = Math.random() * total;
        let rarity: Rarity = 'rare';
        for (const [r, w] of weights) {
          if (roll < w) {
            rarity = r;
            break;
          }
          roll -= w;
        }
        cards.push(generateCard(rarity, this.season));
      }
      this.addCardsToInventory(cards);
    } else if (offer.kind === 'shinyCharm') {
      this.shinyCharmActive = true;
    } else if (offer.kind === 'mythicCloseout') {
      this.awardPack('mythic');
    }

    bus.emit('merchant-changed', this.merchantVisit);
    return true;
  }

  /** Only callable once the Legacy capstone is complete (checked by the
   * caller, to avoid a circular import between state.ts and legacy.ts).
   * Resets almost everything in exchange for a permanent, stacking perk —
   * the encyclopedia and lifetime stats survive so earlier milestones stay
   * complete. */
  prestige(perkId: string): boolean {
    if (!PRESTIGE_PERKS.some((p) => p.id === perkId)) return false;
    this.prestigeLevel += 1;
    this.prestigePerks.push(perkId);

    this.gold = 100;
    this.day = 1;
    this.inventory = [];
    this.shelves = SHOP_SHELF_POSITIONS.map((_, i) => ({ id: `shelf-${i}`, card: null, price: 0 }));
    this.shopUpgrades = defaultShopUpgrades();
    this.townUpgrades = defaultTownUpgrades();
    this.combatUpgrades = defaultCombatUpgrades();
    this.movementUpgrades = defaultMovementUpgrades();
    this.npcs = defaultNpcStates();
    this.ownedPacks = [];
    this.pendingPacks = [];
    this.unlockedZones = ['bramble'];
    this.currentZoneId = 'bramble';
    this.goldEarnedToday = 0;
    this.cardsSoldToday = 0;
    this.enemiesDefeatedToday = 0;
    this.giftsGivenToday = 0;
    this.packsOpenedToday = 0;
    this.fishCaughtToday = 0;
    this.townBoard = rollTownBoard(false);
    this.merchantVisit = null;
    this.shinyCharmActive = false;
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;

    bus.emit('prestige', this.prestigeLevel);
    bus.emit('gold-changed', this.gold);
    bus.emit('day-changed', this.day);
    bus.emit('inventory-changed', this.inventory);
    bus.emit('shelves-changed', this.shelves);
    bus.emit('shop-upgrades-changed', this.shopUpgrades);
    bus.emit('town-upgrades-changed', this.townUpgrades);
    bus.emit('combat-upgrades-changed', this.combatUpgrades);
    bus.emit('movement-upgrades-changed', this.movementUpgrades);
    bus.emit('hp-changed', this.hp);
    bus.emit('energy-changed', this.energy);
    bus.emit('packs-changed', this.ownedPacks);
    bus.emit('zones-changed', this.unlockedZones);
    bus.emit('town-board-changed', this.townBoard);
    bus.emit('merchant-changed', this.merchantVisit);
    return true;
  }

  /** Returns true if this brought the player to 0 HP. */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    bus.emit('hp-changed', this.hp);
    return this.hp <= 0;
  }

  healFully() {
    this.hp = this.maxHp;
    bus.emit('hp-changed', this.hp);
  }

  regenHp(amount: number) {
    if (this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    bus.emit('hp-changed', this.hp);
  }

  awardPack(packId: string) {
    this.ownedPacks.push(packId);
    bus.emit('packs-changed', this.ownedPacks);
  }

  consumeOwnedPack(packId: string): boolean {
    const idx = this.ownedPacks.indexOf(packId);
    if (idx < 0) return false;
    this.ownedPacks.splice(idx, 1);
    bus.emit('packs-changed', this.ownedPacks);
    return true;
  }

  /** Sells one owned (combat-dropped) pack, unopened, for a guaranteed price. */
  sellOwnedPack(packId: string, price: number): boolean {
    if (!this.consumeOwnedPack(packId)) return false;
    this.addGold(price);
    return true;
  }

  /** Buying a pack at the counter places an overnight order — it shows up
   * as an ownedPack (openable) the next day, not immediately. */
  buyPackPending(packId: string, cost: number): boolean {
    if (!this.spendGold(cost)) return false;
    this.pendingPacks.push(packId);
    bus.emit('packs-changed', this.ownedPacks);
    return true;
  }

  /** Pay a premium to skip the overnight wait and get the pack right now. */
  buyPackRush(packId: string, cost: number): boolean {
    if (!this.spendGold(cost)) return false;
    this.ownedPacks.push(packId);
    bus.emit('packs-changed', this.ownedPacks);
    return true;
  }

  restoreEnergy(amount: number) {
    this.energy = Math.min(this.maxEnergy, this.energy + amount);
    bus.emit('energy-changed', this.energy);
  }

  buyEnergyTonic(cost: number, restoreAmount: number): boolean {
    if (!this.spendGold(cost)) return false;
    this.restoreEnergy(restoreAmount);
    return true;
  }

  /** Casts a line at the fountain — requires it be repaired, and a full
   * cast's worth of energy up front (never partially drains you below what
   * it costs). A quiet, no-risk way to spend energy for a small, reliable
   * bit of gold instead of the Wilds or nothing at all. */
  castFishingLine(): { fish: FishDef; goldEarned: number } | null {
    if (!this.townUpgrades.fountainRepaired) return null;
    if (this.energy < FISHING_ENERGY_COST) return null;
    this.energy -= FISHING_ENERGY_COST;
    bus.emit('energy-changed', this.energy);

    const fish = rollFish();
    const goldEarned = Math.round(fish.minValue + Math.random() * (fish.maxValue - fish.minValue));
    this.addGold(goldEarned);
    this.fishCaught[fish.id] = (this.fishCaught[fish.id] ?? 0) + 1;
    this.lifetimeFishCaught += 1;
    this.fishCaughtToday += 1;
    bus.emit('board-progress-changed');
    return { fish, goldEarned };
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    bus.emit('paused-changed', paused);
  }

  /** Passive drain always applies; pass extraDrainPerSec for activity-specific
   * exertion (e.g. the Wilds) on top of it. */
  tickEnergy(deltaMs: number, extraDrainPerSec = 0) {
    if (this.paused) return;
    const enduringSpiritTiers = this.prestigePerks.filter((p) => p === 'enduringSpirit').length;
    const drainMultiplier = Math.max(0.1, 1 - enduringSpiritTiers * 0.15);
    const drain = (ENERGY_DRAIN_PER_SEC + extraDrainPerSec) * drainMultiplier * (deltaMs / 1000);
    if (drain <= 0) return;
    this.energy = Math.max(0, this.energy - drain);
    bus.emit('energy-changed', this.energy);
  }

  /** Manually called — days no longer end on a timer, only when the player
   * chooses to (e.g. the End Day button). */
  endDay() {
    const summary: DaySummary = {
      day: this.day,
      season: this.season,
      goldEarned: this.goldEarnedToday,
      cardsSold: this.cardsSoldToday,
      packsArrived: this.pendingPacks.length,
    };
    this.day += 1;
    this.goldEarnedToday = 0;
    this.cardsSoldToday = 0;
    this.enemiesDefeatedToday = 0;
    this.giftsGivenToday = 0;
    this.packsOpenedToday = 0;
    this.fishCaughtToday = 0;
    this.energy = this.maxEnergy;
    if (this.pendingPacks.length > 0) {
      this.ownedPacks.push(...this.pendingPacks);
      this.pendingPacks = [];
      bus.emit('packs-changed', this.ownedPacks);
    }
    this.townBoard = rollTownBoard(this.townUpgrades.fountainRepaired);
    this.merchantVisit = Math.random() < MERCHANT_VISIT_CHANCE ? { day: this.day, offers: rollMerchantOffers() } : null;
    bus.emit('energy-changed', this.energy);
    bus.emit('day-changed', this.day);
    bus.emit('day-summary', summary);
    bus.emit('town-board-changed', this.townBoard);
    bus.emit('merchant-changed', this.merchantVisit);
  }
}

export const gameState = new GameState();
