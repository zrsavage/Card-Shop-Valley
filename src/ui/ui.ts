import { gameState, bus, DAY_LENGTH_MS, type DaySummary } from '../game/state';
import { PACKS, openPack, type PackDefinition } from '../game/packs';
import { RARITY_LABELS } from '../game/cards';
import { NPCS, friendshipTier, FRIENDSHIP_TIER_LABELS } from '../game/npcs';
import type { Card, ShopUpgrades, TownUpgrades } from '../game/types';

let modalLayer: HTMLDivElement;

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function cardChipHtml(card: Card, extraHtml = '', small = false): string {
  return `
    <div class="card-chip rarity-${card.rarity}${small ? ' card-chip-small' : ''}">
      <div class="card-name">${card.name}</div>
      <div class="card-rarity">${RARITY_LABELS[card.rarity]}</div>
      <div class="card-value">${card.baseValue}g</div>
      ${extraHtml}
    </div>
  `;
}

function renderModal(inner: string) {
  modalLayer.innerHTML = `<div class="modal-backdrop"><div class="modal">${inner}</div></div>`;
  gameState.setPaused(true);
}

function closeModal() {
  modalLayer.innerHTML = '';
  gameState.setPaused(false);
}

// --- Shop / Town upgrade definitions ---

interface ShopUpgradeDef {
  key: keyof ShopUpgrades;
  name: string;
  cost: number;
  description: string;
  requiresKey?: keyof ShopUpgrades;
}

const SHOP_UPGRADE_DEFS: ShopUpgradeDef[] = [
  { key: 'extraShelvesTier1', name: 'Add 2 Shelves', cost: 300, description: 'Unlocks two more display shelves near the counter.' },
  {
    key: 'extraShelvesTier2',
    name: 'Add 2 More Shelves',
    cost: 800,
    description: 'Unlocks a further two shelves (10 total).',
    requiresKey: 'extraShelvesTier1',
  },
  { key: 'marketingSign', name: 'Marketing Sign', cost: 200, description: 'Customers visit the shop more often.' },
  { key: 'appraisersLoupe', name: "Appraiser's Loupe", cost: 400, description: 'Customers tolerate higher markups.' },
];

interface TownUpgradeDef {
  key: keyof TownUpgrades;
  name: string;
  cost: number;
  description: string;
}

const TOWN_UPGRADE_DEFS: TownUpgradeDef[] = [
  { key: 'fountainRepaired', name: 'Repair the Fountain', cost: 250, description: 'Talking to townsfolk earns a bit more friendship.' },
  { key: 'festivalsUnlocked', name: 'Sponsor the Festival', cost: 600, description: 'Every 7th day becomes a Festival with a rush of customers.' },
];

function upgradeRowHtml(
  key: string,
  name: string,
  cost: number,
  description: string,
  owned: boolean,
  locked: boolean,
): string {
  let buttonHtml: string;
  if (owned) {
    buttonHtml = `<button class="btn btn-secondary" disabled>Owned</button>`;
  } else if (locked) {
    buttonHtml = `<button class="btn btn-secondary" disabled>Locked</button>`;
  } else {
    buttonHtml = `<button class="btn buy-upgrade-btn" data-key="${key}" ${gameState.gold < cost ? 'disabled' : ''}>${cost}g</button>`;
  }
  return `
    <div class="pack-row">
      <div class="pack-info">
        <div class="pack-name">${name}</div>
        <div class="pack-meta">${description}</div>
      </div>
      ${buttonHtml}
    </div>
  `;
}

function shopUpgradesHtml(): string {
  return SHOP_UPGRADE_DEFS.map((def) => {
    const owned = gameState.shopUpgrades[def.key];
    const locked = !!def.requiresKey && !gameState.shopUpgrades[def.requiresKey];
    return upgradeRowHtml(def.key, def.name, def.cost, def.description, owned, locked);
  }).join('');
}

// --- Counter (packs + shop upgrades) ---

function openCounterModal() {
  const packRows = PACKS.map(
    (p) => `
      <div class="pack-row">
        <div class="pack-swatch" style="background:${colorToCss(p.color)}"></div>
        <div class="pack-info">
          <div class="pack-name">${p.name}</div>
          <div class="pack-meta">${p.cardCount} cards</div>
        </div>
        <button class="btn buy-pack-btn" data-pack="${p.id}" ${gameState.gold < p.cost ? 'disabled' : ''}>${p.cost}g</button>
      </div>
    `,
  ).join('');

  renderModal(`
    <h2>Pack Counter</h2>
    <p class="modal-sub">Buy a pack of cards to stock your shelves.</p>
    <div class="pack-list">${packRows}</div>
    <h2 class="modal-section-title">Shop Upgrades</h2>
    <div class="pack-list">${shopUpgradesHtml()}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-pack-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack) as PackDefinition;
      if (!gameState.spendGold(pack.cost)) return;
      const cards = openPack(pack);
      openPackRevealModal(pack, cards);
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const def = SHOP_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key)!;
      gameState.purchaseShopUpgrade(def.key, def.cost);
      openCounterModal();
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

function openPackRevealModal(pack: PackDefinition, cards: Card[]) {
  const cardsHtml = cards.map((c) => cardChipHtml(c)).join('');
  renderModal(`
    <h2>${pack.name} Opened!</h2>
    <div class="reveal-grid">${cardsHtml}</div>
    <button class="btn collect-btn">Collect Cards</button>
  `);
  modalLayer.querySelector('.collect-btn')!.addEventListener('click', () => {
    gameState.addCardsToInventory(cards);
    closeModal();
  });
}

// --- Shelf ---

function openShelfModal(shelfId: string) {
  const shelf = gameState.shelves.find((s) => s.id === shelfId)!;
  let bodyHtml: string;

  if (shelf.card) {
    bodyHtml = `
      <div class="reveal-grid">${cardChipHtml(shelf.card)}</div>
      <label class="field-label">Price
        <input type="number" id="reprice-input" min="1" value="${shelf.price}" />
      </label>
      <div class="modal-actions">
        <button class="btn update-price-btn">Update Price</button>
        <button class="btn btn-secondary remove-card-btn">Remove to Bag</button>
      </div>
    `;
  } else if (gameState.inventory.length === 0) {
    bodyHtml = `<p class="modal-sub">This shelf is empty, and your bag has no cards. Buy a pack at the counter!</p>`;
  } else {
    const items = gameState.inventory
      .map(
        (c, idx) => `
          <div class="inventory-row" data-idx="${idx}">
            ${cardChipHtml(c)}
            <input type="number" class="place-price-input" min="1" value="${c.baseValue}" />
            <button class="btn place-btn" data-idx="${idx}">Place</button>
          </div>
        `,
      )
      .join('');
    bodyHtml = `<div class="inventory-list">${items}</div>`;
  }

  renderModal(`
    <h2>Shelf</h2>
    ${bodyHtml}
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  if (shelf.card) {
    modalLayer.querySelector('.update-price-btn')!.addEventListener('click', () => {
      const input = modalLayer.querySelector('#reprice-input') as HTMLInputElement;
      gameState.repriceShelf(shelfId, Number(input.value));
      closeModal();
    });
    modalLayer.querySelector('.remove-card-btn')!.addEventListener('click', () => {
      gameState.clearShelf(shelfId);
      closeModal();
    });
  } else {
    modalLayer.querySelectorAll<HTMLButtonElement>('.place-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const card = gameState.inventory[idx];
        const row = btn.closest('.inventory-row') as HTMLElement;
        const priceInput = row.querySelector('.place-price-input') as HTMLInputElement;
        gameState.placeOnShelf(shelfId, card.id, Number(priceInput.value));
        closeModal();
      });
    });
  }
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Day summary ---

function openDaySummaryModal(summary: DaySummary) {
  renderModal(`
    <h2>Day ${summary.day} Complete!</h2>
    <p class="modal-sub">${summary.season} &middot; Earned <strong>${summary.goldEarned}g</strong> from ${summary.cardsSold} sale${summary.cardsSold === 1 ? '' : 's'}.</p>
    <button class="btn start-day-btn">Start Day ${summary.day + 1}</button>
  `);
  modalLayer.querySelector('.start-day-btn')!.addEventListener('click', closeModal);
}

// --- Town Hall ---

function openTownHallModal() {
  const rows = TOWN_UPGRADE_DEFS.map((def) => {
    const owned = gameState.townUpgrades[def.key];
    return upgradeRowHtml(def.key, def.name, def.cost, def.description, owned, false);
  }).join('');

  renderModal(`
    <h2>Town Hall</h2>
    <p class="modal-sub">Invest your gold back into the town.</p>
    <div class="pack-list">${rows}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const def = TOWN_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key)!;
      gameState.purchaseTownUpgrade(def.key, def.cost);
      openTownHallModal();
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- NPC dialogue ---

function openNpcModal(npcId: string) {
  const def = NPCS.find((n) => n.id === npcId)!;
  const npcState = gameState.npcs[npcId];
  const tier = friendshipTier(npcState.friendship);
  const line = def.lines[tier][Math.floor(Math.random() * def.lines[tier].length)];
  const alreadyTalkedToday = npcState.lastTalkedDay === gameState.day;

  const giftRows =
    gameState.inventory.length === 0
      ? `<p class="modal-sub">You have no cards in your bag to gift.</p>`
      : gameState.inventory
          .map(
            (c, idx) => `
              <div class="inventory-row" data-idx="${idx}">
                ${cardChipHtml(c)}
                <button class="btn gift-btn" data-idx="${idx}">Gift</button>
              </div>
            `,
          )
          .join('');

  renderModal(`
    <h2>${def.name}</h2>
    <div class="npc-tier">${FRIENDSHIP_TIER_LABELS[tier]}</div>
    <div class="friend-bar"><div class="friend-bar-fill" style="width:${npcState.friendship}%"></div></div>
    <p class="npc-line">"${line}"</p>
    <div class="modal-actions">
      <button class="btn talk-btn" ${alreadyTalkedToday ? 'disabled' : ''}>${alreadyTalkedToday ? 'Already talked today' : 'Talk'}</button>
    </div>
    <h2 class="modal-section-title">Give a Gift</h2>
    <div class="inventory-list">${giftRows}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  const talkBtn = modalLayer.querySelector('.talk-btn') as HTMLButtonElement;
  talkBtn.addEventListener('click', () => {
    gameState.talkToNpc(npcId);
    openNpcModal(npcId);
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.gift-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const card = gameState.inventory[idx];
      gameState.giftCardToNpc(npcId, card.id);
      openNpcModal(npcId);
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- HUD / inventory tray ---

function renderInventoryTray() {
  const tray = document.getElementById('inventory-tray')!;
  if (gameState.inventory.length === 0) {
    tray.innerHTML = `<div class="tray-empty">Bag empty — buy a pack at the counter</div>`;
    return;
  }
  tray.innerHTML = `
    <div class="tray-label">Bag (${gameState.inventory.length})</div>
    <div class="tray-items">${gameState.inventory.map((c) => cardChipHtml(c, '', true)).join('')}</div>
  `;
}

function renderSeasonBadge() {
  const el = document.getElementById('season-value');
  if (el) el.textContent = gameState.season;
  const festival = document.getElementById('festival-banner');
  if (festival) festival.hidden = !gameState.isFestivalDay;
}

export function initUI() {
  const root = document.getElementById('ui-root') as HTMLDivElement;
  root.innerHTML = `
    <div id="hud">
      <div class="hud-stat">Gold: <span id="gold-value">${gameState.gold}</span>g</div>
      <div class="hud-stat">Day <span id="day-value">${gameState.day}</span> &middot; <span id="season-value">${gameState.season}</span></div>
      <div id="festival-banner" class="festival-banner" ${gameState.isFestivalDay ? '' : 'hidden'}>🎉 Festival</div>
      <div class="hud-timebar"><div id="time-fill" class="time-fill"></div></div>
      <button id="end-day-btn" class="btn btn-small">End Day</button>
    </div>
    <div id="inventory-tray"></div>
    <div id="modal-layer"></div>
  `;
  modalLayer = root.querySelector('#modal-layer') as HTMLDivElement;

  document.getElementById('end-day-btn')!.addEventListener('click', () => {
    gameState.endDay();
  });

  renderInventoryTray();
  renderSeasonBadge();

  bus.on('gold-changed', (gold: number) => {
    document.getElementById('gold-value')!.textContent = String(gold);
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-pack-btn').forEach((btn) => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack);
      if (pack) btn.disabled = gold < pack.cost;
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
      const def =
        SHOP_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key) ?? TOWN_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      if (def) btn.disabled = gold < def.cost;
    });
  });
  bus.on('day-changed', (day: number) => {
    document.getElementById('day-value')!.textContent = String(day);
    renderSeasonBadge();
  });
  bus.on('time-changed', (ms: number) => {
    const pct = Math.max(0, Math.min(100, (ms / DAY_LENGTH_MS) * 100));
    const fill = document.getElementById('time-fill');
    if (fill) fill.style.width = `${pct}%`;
  });
  bus.on('inventory-changed', renderInventoryTray);
  bus.on('open-counter', openCounterModal);
  bus.on('open-shelf', (shelfId: string) => openShelfModal(shelfId));
  bus.on('day-summary', (summary: DaySummary) => openDaySummaryModal(summary));
  bus.on('open-townhall', openTownHallModal);
  bus.on('open-npc', (npcId: string) => openNpcModal(npcId));
}
