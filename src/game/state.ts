import Phaser from 'phaser';
import type { Card, ShelfSlot, Season, ShopUpgrades, TownUpgrades, CombatUpgrades, NpcState } from './types';
import { SHOP_SHELF_POSITIONS } from './layout';
import { NPCS } from './npcs';

export const bus = new Phaser.Events.EventEmitter();

export const SHELF_COUNT = SHOP_SHELF_POSITIONS.length;
export const DAYS_PER_SEASON = 7;
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];

export const PLAYER_BASE_ATTACK_DAMAGE = 14;
export const WEAPON_TIER_DAMAGE_BONUS = 6;
export const PLAYER_BASE_MAX_HP = 100;
export const VITALITY_TIER_HP_BONUS = 40;

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
    vitalityTier1: false,
    vitalityTier2: false,
    vitalityTier3: false,
  };
}

function defaultNpcStates(): Record<string, NpcState> {
  const record: Record<string, NpcState> = {};
  for (const npc of NPCS) {
    record[npc.id] = { friendship: 0, lastTalkedDay: 0 };
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
  npcs: Record<string, NpcState> = defaultNpcStates();

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
    const tiers = [this.combatUpgrades.weaponTier1, this.combatUpgrades.weaponTier2, this.combatUpgrades.weaponTier3].filter(
      Boolean,
    ).length;
    return PLAYER_BASE_ATTACK_DAMAGE + tiers * WEAPON_TIER_DAMAGE_BONUS;
  }

  get maxHp(): number {
    const tiers = [this.combatUpgrades.vitalityTier1, this.combatUpgrades.vitalityTier2, this.combatUpgrades.vitalityTier3].filter(
      Boolean,
    ).length;
    return PLAYER_BASE_MAX_HP + tiers * VITALITY_TIER_HP_BONUS;
  }

  get maxEnergy(): number {
    return PLAYER_MAX_ENERGY;
  }

  get isExhausted(): boolean {
    return this.energy <= 0;
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
    const price = shelf.price;
    shelf.card = null;
    shelf.price = 0;
    this.addGold(price);
    this.goldEarnedToday += price;
    this.cardsSoldToday += 1;
    this.lifetimeCardsSold += 1;
    bus.emit('shelves-changed', this.shelves);
    return price;
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

  giftCardToNpc(npcId: string, cardId: string): number {
    const card = this.removeFromInventory(cardId);
    if (!card) return 0;
    const gain = Math.max(2, Math.round(card.baseValue / 4));
    const npc = this.npcs[npcId];
    npc.friendship = Math.min(100, npc.friendship + gain);
    bus.emit('npc-changed', npcId);
    return gain;
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

  setPaused(paused: boolean) {
    this.paused = paused;
    bus.emit('paused-changed', paused);
  }

  /** Passive drain always applies; pass extraDrainPerSec for activity-specific
   * exertion (e.g. the Wilds) on top of it. */
  tickEnergy(deltaMs: number, extraDrainPerSec = 0) {
    if (this.paused) return;
    const drain = (ENERGY_DRAIN_PER_SEC + extraDrainPerSec) * (deltaMs / 1000);
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
    this.energy = this.maxEnergy;
    if (this.pendingPacks.length > 0) {
      this.ownedPacks.push(...this.pendingPacks);
      this.pendingPacks = [];
      bus.emit('packs-changed', this.ownedPacks);
    }
    bus.emit('energy-changed', this.energy);
    bus.emit('day-changed', this.day);
    bus.emit('day-summary', summary);
  }
}

export const gameState = new GameState();
