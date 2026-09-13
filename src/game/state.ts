import Phaser from 'phaser';
import type { Card, ShelfSlot, Season, ShopUpgrades, TownUpgrades, NpcState } from './types';
import { SHOP_SHELF_POSITIONS } from './layout';
import { NPCS } from './npcs';

export const bus = new Phaser.Events.EventEmitter();

export const SHELF_COUNT = SHOP_SHELF_POSITIONS.length;
export const DAY_LENGTH_MS = 90_000;
export const DAYS_PER_SEASON = 7;
export const SEASONS: Season[] = ['Spring', 'Summer', 'Fall', 'Winter'];

export interface DaySummary {
  day: number;
  season: Season;
  goldEarned: number;
  cardsSold: number;
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
  npcs: Record<string, NpcState> = defaultNpcStates();

  dayTimeRemaining = DAY_LENGTH_MS;
  paused = false;
  goldEarnedToday = 0;
  cardsSoldToday = 0;

  maxHp = 100;
  hp = 100;
  /** Pack ids earned from combat, awaiting a free open at the counter. */
  ownedPacks: string[] = [];

  get season(): Season {
    return SEASONS[Math.floor((this.day - 1) / DAYS_PER_SEASON) % SEASONS.length];
  }

  get isFestivalDay(): boolean {
    return this.townUpgrades.festivalsUnlocked && this.day % 7 === 0;
  }

  addGold(amount: number) {
    this.gold += amount;
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
    bus.emit('inventory-changed', this.inventory);
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

  setPaused(paused: boolean) {
    this.paused = paused;
    bus.emit('paused-changed', paused);
  }

  tickDay(deltaMs: number) {
    if (this.paused) return;
    this.dayTimeRemaining -= deltaMs;
    bus.emit('time-changed', Math.max(0, this.dayTimeRemaining));
    if (this.dayTimeRemaining <= 0) {
      this.endDay();
    }
  }

  endDay() {
    const summary: DaySummary = {
      day: this.day,
      season: this.season,
      goldEarned: this.goldEarnedToday,
      cardsSold: this.cardsSoldToday,
    };
    this.day += 1;
    this.dayTimeRemaining = DAY_LENGTH_MS;
    this.goldEarnedToday = 0;
    this.cardsSoldToday = 0;
    bus.emit('day-changed', this.day);
    bus.emit('day-summary', summary);
  }
}

export const gameState = new GameState();
