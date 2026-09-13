import { gameState, bus } from './state';
import type { Card, ShelfSlot, ShopUpgrades, TownUpgrades, NpcState } from './types';

const SAVE_KEY = 'card-shop-valley-save-v1';

interface SaveData {
  gold: number;
  day: number;
  inventory: Card[];
  shelves: ShelfSlot[];
  shopUpgrades: ShopUpgrades;
  townUpgrades: TownUpgrades;
  npcs: Record<string, NpcState>;
  ownedPacks: string[];
}

export function saveGame() {
  try {
    const data: SaveData = {
      gold: gameState.gold,
      day: gameState.day,
      inventory: gameState.inventory,
      shelves: gameState.shelves,
      shopUpgrades: gameState.shopUpgrades,
      townUpgrades: gameState.townUpgrades,
      npcs: gameState.npcs,
      ownedPacks: gameState.ownedPacks,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, storage disabled, etc.) — skip silently.
  }
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (typeof data.gold === 'number') gameState.gold = data.gold;
    if (typeof data.day === 'number') gameState.day = data.day;
    if (Array.isArray(data.inventory)) gameState.inventory = data.inventory;
    if (Array.isArray(data.shelves)) {
      // Merge by id so a save from before a shelf-count change (e.g. new
      // upgrade tiers shipped) still lines up with the current layout.
      for (const saved of data.shelves) {
        const shelf = gameState.shelves.find((s) => s.id === saved.id);
        if (shelf) {
          shelf.card = saved.card;
          shelf.price = saved.price;
        }
      }
    }
    if (data.shopUpgrades) Object.assign(gameState.shopUpgrades, data.shopUpgrades);
    if (data.townUpgrades) Object.assign(gameState.townUpgrades, data.townUpgrades);
    if (data.npcs) {
      for (const [id, npcState] of Object.entries(data.npcs)) {
        if (gameState.npcs[id]) gameState.npcs[id] = npcState;
      }
    }
    if (Array.isArray(data.ownedPacks)) gameState.ownedPacks = data.ownedPacks;
    return true;
  } catch {
    return false;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

let saveQueued = false;
function queueSave() {
  if (saveQueued) return;
  saveQueued = true;
  setTimeout(() => {
    saveQueued = false;
    saveGame();
  }, 300);
}

export function initAutosave() {
  bus.on('day-changed', queueSave);
  bus.on('shop-upgrades-changed', queueSave);
  bus.on('town-upgrades-changed', queueSave);
  bus.on('npc-changed', queueSave);
  bus.on('shelves-changed', queueSave);
  bus.on('inventory-changed', queueSave);
  bus.on('packs-changed', queueSave);
}
