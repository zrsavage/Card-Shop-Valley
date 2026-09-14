import { gameState, bus } from './state';
import type {
  Card,
  ShelfSlot,
  ShopUpgrades,
  TownUpgrades,
  CombatUpgrades,
  MovementUpgrades,
  NpcState,
  BoardObjective,
  MerchantVisit,
} from './types';

const SAVE_KEY = 'card-shop-valley-save-v1';

interface SaveData {
  gold: number;
  day: number;
  inventory: Card[];
  shelves: ShelfSlot[];
  shopUpgrades: ShopUpgrades;
  townUpgrades: TownUpgrades;
  combatUpgrades: CombatUpgrades;
  movementUpgrades: MovementUpgrades;
  npcs: Record<string, NpcState>;
  ownedPacks: string[];
  pendingPacks: string[];
  unlockedZones: string[];
  currentZoneId: string;
  lifetimeGoldEarned: number;
  lifetimeCardsSold: number;
  discoveredCards: string[];
  enemiesDefeatedToday: number;
  giftsGivenToday: number;
  packsOpenedToday: number;
  townBoard: BoardObjective[];
  merchantVisit: MerchantVisit | null;
  shinyCharmActive: boolean;
  prestigeLevel: number;
  prestigePerks: string[];
  ownedOutfits: string[];
  equippedOutfitId: string;
  ownedDecor: string[];
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
      combatUpgrades: gameState.combatUpgrades,
      npcs: gameState.npcs,
      ownedPacks: gameState.ownedPacks,
      pendingPacks: gameState.pendingPacks,
      unlockedZones: gameState.unlockedZones,
      currentZoneId: gameState.currentZoneId,
      lifetimeGoldEarned: gameState.lifetimeGoldEarned,
      lifetimeCardsSold: gameState.lifetimeCardsSold,
      discoveredCards: [...gameState.discoveredCards],
      enemiesDefeatedToday: gameState.enemiesDefeatedToday,
      giftsGivenToday: gameState.giftsGivenToday,
      packsOpenedToday: gameState.packsOpenedToday,
      townBoard: gameState.townBoard,
      merchantVisit: gameState.merchantVisit,
      shinyCharmActive: gameState.shinyCharmActive,
      prestigeLevel: gameState.prestigeLevel,
      prestigePerks: gameState.prestigePerks,
      movementUpgrades: gameState.movementUpgrades,
      ownedOutfits: gameState.ownedOutfits,
      equippedOutfitId: gameState.equippedOutfitId,
      ownedDecor: gameState.ownedDecor,
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
    if (data.combatUpgrades) Object.assign(gameState.combatUpgrades, data.combatUpgrades);
    if (data.movementUpgrades) Object.assign(gameState.movementUpgrades, data.movementUpgrades);
    if (data.npcs) {
      for (const [id, npcState] of Object.entries(data.npcs)) {
        if (gameState.npcs[id]) gameState.npcs[id] = npcState;
      }
    }
    if (Array.isArray(data.ownedPacks)) gameState.ownedPacks = data.ownedPacks;
    if (Array.isArray(data.pendingPacks)) gameState.pendingPacks = data.pendingPacks;
    if (Array.isArray(data.unlockedZones)) gameState.unlockedZones = data.unlockedZones;
    if (typeof data.currentZoneId === 'string') gameState.currentZoneId = data.currentZoneId;
    if (typeof data.lifetimeGoldEarned === 'number') gameState.lifetimeGoldEarned = data.lifetimeGoldEarned;
    if (typeof data.lifetimeCardsSold === 'number') gameState.lifetimeCardsSold = data.lifetimeCardsSold;
    if (Array.isArray(data.discoveredCards)) gameState.discoveredCards = new Set(data.discoveredCards);
    if (typeof data.enemiesDefeatedToday === 'number') gameState.enemiesDefeatedToday = data.enemiesDefeatedToday;
    if (typeof data.giftsGivenToday === 'number') gameState.giftsGivenToday = data.giftsGivenToday;
    if (typeof data.packsOpenedToday === 'number') gameState.packsOpenedToday = data.packsOpenedToday;
    if (Array.isArray(data.townBoard)) gameState.townBoard = data.townBoard;
    if (data.merchantVisit !== undefined) gameState.merchantVisit = data.merchantVisit;
    if (typeof data.shinyCharmActive === 'boolean') gameState.shinyCharmActive = data.shinyCharmActive;
    if (typeof data.prestigeLevel === 'number') gameState.prestigeLevel = data.prestigeLevel;
    if (Array.isArray(data.prestigePerks)) gameState.prestigePerks = data.prestigePerks;
    if (Array.isArray(data.ownedOutfits)) gameState.ownedOutfits = data.ownedOutfits;
    if (typeof data.equippedOutfitId === 'string') gameState.equippedOutfitId = data.equippedOutfitId;
    if (Array.isArray(data.ownedDecor)) gameState.ownedDecor = data.ownedDecor;
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
  bus.on('combat-upgrades-changed', queueSave);
  bus.on('npc-changed', queueSave);
  bus.on('shelves-changed', queueSave);
  bus.on('inventory-changed', queueSave);
  bus.on('cards-discovered', queueSave);
  bus.on('packs-changed', queueSave);
  bus.on('zones-changed', queueSave);
  bus.on('zone-changed', queueSave);
  bus.on('town-board-changed', queueSave);
  bus.on('merchant-changed', queueSave);
  bus.on('board-progress-changed', queueSave);
  bus.on('prestige', queueSave);
  bus.on('movement-upgrades-changed', queueSave);
  bus.on('cosmetics-changed', queueSave);
}
