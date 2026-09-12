import Phaser from 'phaser';
import type { Card, ShelfSlot } from './types';

export const bus = new Phaser.Events.EventEmitter();

export const SHELF_COUNT = 6;
export const DAY_LENGTH_MS = 90_000;

export interface DaySummary {
  day: number;
  goldEarned: number;
  cardsSold: number;
}

class GameState {
  gold = 100;
  day = 1;
  inventory: Card[] = [];
  shelves: ShelfSlot[] = Array.from({ length: SHELF_COUNT }, (_, i) => ({
    id: `shelf-${i}`,
    card: null,
    price: 0,
  }));

  dayTimeRemaining = DAY_LENGTH_MS;
  paused = false;
  goldEarnedToday = 0;
  cardsSoldToday = 0;

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

  setPaused(paused: boolean) {
    this.paused = paused;
    bus.emit('paused-changed', paused);
  }

  endDay() {
    const summary: DaySummary = {
      day: this.day,
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
