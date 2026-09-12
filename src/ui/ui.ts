import { gameState, bus, DAY_LENGTH_MS, type DaySummary } from '../game/state';
import { PACKS, openPack, type PackDefinition } from '../game/packs';
import { RARITY_LABELS } from '../game/cards';
import type { Card } from '../game/types';

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

function openPacksModal() {
  const rows = PACKS.map(
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
    <div class="pack-list">${rows}</div>
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

function openDaySummaryModal(summary: DaySummary) {
  renderModal(`
    <h2>Day ${summary.day} Complete!</h2>
    <p class="modal-sub">Earned <strong>${summary.goldEarned}g</strong> from ${summary.cardsSold} sale${summary.cardsSold === 1 ? '' : 's'}.</p>
    <button class="btn start-day-btn">Start Day ${summary.day + 1}</button>
  `);
  modalLayer.querySelector('.start-day-btn')!.addEventListener('click', closeModal);
}

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

export function initUI() {
  const root = document.getElementById('ui-root') as HTMLDivElement;
  root.innerHTML = `
    <div id="hud">
      <div class="hud-stat">Gold: <span id="gold-value">${gameState.gold}</span>g</div>
      <div class="hud-stat">Day <span id="day-value">${gameState.day}</span></div>
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

  bus.on('gold-changed', (gold: number) => {
    document.getElementById('gold-value')!.textContent = String(gold);
    const buyButtons = modalLayer.querySelectorAll<HTMLButtonElement>('.buy-pack-btn');
    buyButtons.forEach((btn) => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack);
      if (pack) btn.disabled = gold < pack.cost;
    });
  });
  bus.on('day-changed', (day: number) => {
    document.getElementById('day-value')!.textContent = String(day);
  });
  bus.on('time-changed', (ms: number) => {
    const pct = Math.max(0, Math.min(100, (ms / DAY_LENGTH_MS) * 100));
    const fill = document.getElementById('time-fill');
    if (fill) fill.style.width = `${pct}%`;
  });
  bus.on('inventory-changed', renderInventoryTray);
  bus.on('open-counter', openPacksModal);
  bus.on('open-shelf', (shelfId: string) => openShelfModal(shelfId));
  bus.on('day-summary', (summary: DaySummary) => openDaySummaryModal(summary));
}
