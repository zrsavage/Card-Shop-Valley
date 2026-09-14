import { gameState, bus, DAY_LENGTH_MS, WEAPON_TIER_DAMAGE_BONUS, VITALITY_TIER_HP_BONUS, SEASONS, type DaySummary } from '../game/state';
import { PACKS, openPack, type PackDefinition } from '../game/packs';
import { RARITIES, RARITY_LABELS, RARITY_BASE_VALUE, SEASON_PRICE_MULTIPLIER } from '../game/cards';
import { NPCS, friendshipTier, FRIENDSHIP_TIER_LABELS } from '../game/npcs';
import { generateCardArtSvg, cardArtImagePath } from '../game/cardArt';
import { SEASON_SET_NAME, SEASON_CARD_POOL, STAGE_VALUE_MULTIPLIER, type SpeciesCard } from '../game/species';
import { ZONE_DEFS } from '../game/combat';
import type { Card, ShopUpgrades, TownUpgrades, CombatUpgrades, Season } from '../game/types';

function effectivePackCost(pack: PackDefinition): number {
  return Math.round(pack.cost * SEASON_PRICE_MULTIPLIER[gameState.season]);
}

let modalLayer: HTMLDivElement;

function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

// The card face itself never shows gold value — real trading cards don't
// print a price on them. Value is shown separately via cardSlotHtml() below,
// as a tag alongside the card rather than baked into its frame.
function cardChipHtml(card: Card, small = false): string {
  const fallbackArt = generateCardArtSvg(card.speciesId, card.season, card.rarity, card.stage);
  // The illustrated image may not exist yet (art is rolled out species by
  // species) — if it 404s, swap back to the procedural art beside it.
  const art = `
    <img class="card-art-img" src="${cardArtImagePath(card.speciesId)}" alt=""
      onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
    <div class="card-art-fallback" style="display:none">${fallbackArt}</div>
  `;
  const stageBadge = card.stageCount > 1 ? `<div class="stage-badge">${card.stage}/${card.stageCount}</div>` : '';
  const setLine = small ? '' : `<div class="card-set-name">${SEASON_SET_NAME[card.season]}</div>`;
  return `
    <div class="card-chip rarity-${card.rarity}${small ? ' card-chip-small' : ''}">
      <div class="card-inner">
        <div class="card-name">${card.name}</div>
        <div class="card-art-window">${art}${stageBadge}</div>
        <div class="card-footer">
          <span class="card-rarity-pill rarity-pill-${card.rarity}">${RARITY_LABELS[card.rarity]}</span>
        </div>
        ${setLine}
      </div>
    </div>
  `;
}

// A card plus its current market value shown as a separate tag underneath —
// used wherever the player needs the price for a decision (unpacking,
// shelving, gifting), without the value living on the card itself.
function cardSlotHtml(card: Card, small = false): string {
  return `
    <div class="card-slot">
      ${cardChipHtml(card, small)}
      <div class="value-tag">${card.baseValue}g</div>
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

interface CombatUpgradeDef {
  key: keyof CombatUpgrades;
  name: string;
  cost: number;
  description: string;
  requiresKey?: keyof CombatUpgrades;
}

const COMBAT_UPGRADE_DEFS: CombatUpgradeDef[] = [
  { key: 'weaponTier1', name: 'Sharpen Weapon I', cost: 150, description: `+${WEAPON_TIER_DAMAGE_BONUS} attack damage in the Wilds.` },
  {
    key: 'weaponTier2',
    name: 'Sharpen Weapon II',
    cost: 400,
    description: `+${WEAPON_TIER_DAMAGE_BONUS} more attack damage.`,
    requiresKey: 'weaponTier1',
  },
  {
    key: 'weaponTier3',
    name: 'Sharpen Weapon III',
    cost: 900,
    description: `+${WEAPON_TIER_DAMAGE_BONUS} more attack damage.`,
    requiresKey: 'weaponTier2',
  },
  { key: 'vitalityTier1', name: 'Vitality I', cost: 150, description: `+${VITALITY_TIER_HP_BONUS} max HP.` },
  {
    key: 'vitalityTier2',
    name: 'Vitality II',
    cost: 400,
    description: `+${VITALITY_TIER_HP_BONUS} more max HP.`,
    requiresKey: 'vitalityTier1',
  },
  {
    key: 'vitalityTier3',
    name: 'Vitality III',
    cost: 900,
    description: `+${VITALITY_TIER_HP_BONUS} more max HP.`,
    requiresKey: 'vitalityTier2',
  },
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

// --- Packs earned from combat, free to open ---

function ownedPacksHtml(): string {
  if (gameState.ownedPacks.length === 0) {
    return `<p class="modal-sub">No free packs yet — defeat enemies in the Wilds for a chance at one.</p>`;
  }
  const counts = new Map<string, number>();
  for (const id of gameState.ownedPacks) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => {
      const pack = PACKS.find((p) => p.id === id);
      if (!pack) return '';
      return `
        <div class="pack-row">
          <div class="pack-swatch" style="background:${colorToCss(pack.color)}"></div>
          <div class="pack-info">
            <div class="pack-name">${pack.name}${count > 1 ? ` &times;${count}` : ''}</div>
            <div class="pack-meta">${pack.cardCount} cards &middot; ${SEASON_SET_NAME[gameState.season]}</div>
          </div>
          <button class="btn open-owned-pack-btn" data-pack="${id}">Open Free</button>
          <button class="btn btn-secondary sell-owned-pack-btn" data-pack="${id}">Sell ${pack.sellValue}g</button>
        </div>
      `;
    })
    .join('');
}

// --- Counter (packs + shop upgrades) ---

function openCounterModal() {
  const multiplier = SEASON_PRICE_MULTIPLIER[gameState.season];
  const packRows = PACKS.map((p) => {
    const cost = effectivePackCost(p);
    return `
      <div class="pack-row">
        <div class="pack-swatch" style="background:${colorToCss(p.color)}"></div>
        <div class="pack-info">
          <div class="pack-name">${p.name}</div>
          <div class="pack-meta">${p.cardCount} cards &middot; ${SEASON_SET_NAME[gameState.season]}</div>
        </div>
        <button class="btn buy-pack-btn" data-pack="${p.id}" ${gameState.gold < cost ? 'disabled' : ''}>${cost}g</button>
      </div>
    `;
  }).join('');

  renderModal(`
    <h2>Pack Counter</h2>
    <p class="modal-sub">
      Now stocking <strong>${SEASON_SET_NAME[gameState.season]}</strong> — buy a pack to stock your shelves.
      ${multiplier !== 1 ? `<br><strong>${gameState.season} market:</strong> prices &times;${multiplier}.` : ''}
    </p>
    <div class="pack-list">${packRows}</div>
    <h2 class="modal-section-title">Your Packs</h2>
    <div class="pack-list">${ownedPacksHtml()}</div>
    <h2 class="modal-section-title">Shop Upgrades</h2>
    <div class="pack-list">${shopUpgradesHtml()}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-pack-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack) as PackDefinition;
      if (!gameState.spendGold(effectivePackCost(pack))) return;
      const cards = openPack(pack, gameState.season);
      openPackRevealModal(pack, cards);
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.open-owned-pack-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const packId = btn.dataset.pack!;
      if (!gameState.consumeOwnedPack(packId)) return;
      const pack = PACKS.find((p) => p.id === packId) as PackDefinition;
      const cards = openPack(pack, gameState.season);
      openPackRevealModal(pack, cards);
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.sell-owned-pack-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const packId = btn.dataset.pack!;
      const pack = PACKS.find((p) => p.id === packId) as PackDefinition;
      if (!gameState.sellOwnedPack(packId, pack.sellValue)) return;
      openCounterModal();
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
  const cardsHtml = cards.map((c) => cardSlotHtml(c)).join('');
  const season = cards[0]?.season ?? gameState.season;
  renderModal(`
    <h2>${pack.name} Opened!</h2>
    <p class="modal-sub">${SEASON_SET_NAME[season]}</p>
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
      <div class="reveal-grid">${cardSlotHtml(shelf.card)}</div>
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
            ${cardSlotHtml(c)}
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
    <p class="modal-sub">${SEASON_SET_NAME[summary.season]} &middot; Earned <strong>${summary.goldEarned}g</strong> from ${summary.cardsSold} sale${summary.cardsSold === 1 ? '' : 's'}.</p>
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

  const combatRows = COMBAT_UPGRADE_DEFS.map((def) => {
    const owned = gameState.combatUpgrades[def.key];
    const locked = !!def.requiresKey && !gameState.combatUpgrades[def.requiresKey];
    return upgradeRowHtml(def.key, def.name, def.cost, def.description, owned, locked);
  }).join('');

  renderModal(`
    <h2>Town Hall</h2>
    <p class="modal-sub">Invest your gold back into the town.</p>
    <div class="pack-list">${rows}</div>
    <h2 class="modal-section-title">Adventuring Upgrades</h2>
    <p class="modal-sub">Attack: ${gameState.attackDamage} &middot; Max HP: ${gameState.maxHp}</p>
    <div class="pack-list">${combatRows}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const townDef = TOWN_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      if (townDef) {
        gameState.purchaseTownUpgrade(townDef.key, townDef.cost);
      } else {
        const combatDef = COMBAT_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key)!;
        gameState.purchaseCombatUpgrade(combatDef.key, combatDef.cost);
      }
      openTownHallModal();
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Wilds zone map ---

function openZoneMapModal() {
  const rows = ZONE_DEFS.map((zone) => {
    const unlocked = gameState.unlockedZones.includes(zone.id);
    const current = gameState.currentZoneId === zone.id;
    const actionHtml = unlocked
      ? `<button class="btn enter-zone-btn" data-zone="${zone.id}">Enter</button>`
      : `<button class="btn unlock-zone-btn" data-zone="${zone.id}" ${gameState.gold < zone.unlockCost ? 'disabled' : ''}>Unlock ${zone.unlockCost}g</button>`;
    return `
      <div class="pack-row">
        <div class="pack-info">
          <div class="pack-name">${zone.name}${current ? ' (current)' : ''}</div>
          <div class="pack-meta">${zone.description}</div>
        </div>
        ${actionHtml}
      </div>
    `;
  }).join('');

  renderModal(`
    <h2>Wilds Map</h2>
    <p class="modal-sub">Pick where to hunt. Tougher zones spawn more enemies and drop better packs.</p>
    <div class="pack-list">${rows}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.unlock-zone-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const zone = ZONE_DEFS.find((z) => z.id === btn.dataset.zone)!;
      gameState.unlockZone(zone.id, zone.unlockCost);
      openZoneMapModal();
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.enter-zone-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      gameState.travelToZone(btn.dataset.zone!);
      closeModal();
      bus.emit('enter-wilds');
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
                ${cardSlotHtml(c)}
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

// --- Bag (opened on demand only — it used to sit permanently docked
// across the bottom of the screen, covering the play area) ---

function openBagModal() {
  const body =
    gameState.inventory.length === 0
      ? `<p class="modal-sub">Your bag is empty. Buy or find a pack to fill it up.</p>`
      : `<div class="reveal-grid">${gameState.inventory.map((c) => cardSlotHtml(c)).join('')}</div>`;

  renderModal(`
    <h2>Bag</h2>
    <p class="modal-sub">${gameState.inventory.length} card${gameState.inventory.length === 1 ? '' : 's'} on hand. Place them on a shelf, gift one to a townsfolk, or just browse.</p>
    ${body}
    <button class="btn btn-secondary close-btn">Close</button>
  `);
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Encyclopedia (every card: name, rarity, rough price, art) ---

let encyclopediaSeason: Season = gameState.season;
let encyclopediaQuery = '';

/** Season-neutral estimate — actual sale price also depends on that
 * season's price multiplier and per-card jitter, so this is a "rough"
 * figure rather than what any one copy will actually fetch. */
function roughCardValue(card: SpeciesCard): number {
  return Math.round(RARITY_BASE_VALUE[card.rarity] * STAGE_VALUE_MULTIPLIER[card.stage - 1]);
}

function codexRowHtml(card: SpeciesCard): string {
  const art = `
    <img class="codex-thumb" src="${cardArtImagePath(card.speciesId)}" alt=""
      onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
    <div class="codex-thumb-fallback" style="display:none">${generateCardArtSvg(card.speciesId, encyclopediaSeason, card.rarity, card.stage)}</div>
  `;
  const stageNote = card.stageCount > 1 ? ` &middot; Stage ${card.stage}/${card.stageCount}` : '';
  return `
    <div class="codex-row">
      <div class="codex-thumb-wrap">${art}</div>
      <div class="codex-info">
        <div class="codex-name">${card.name}</div>
        <div class="codex-meta">${RARITY_LABELS[card.rarity]}${stageNote}</div>
      </div>
      <div class="codex-price">~${roughCardValue(card)}g</div>
    </div>
  `;
}

function encyclopediaBodyHtml(): string {
  const pool = SEASON_CARD_POOL[encyclopediaSeason];
  const query = encyclopediaQuery.trim().toLowerCase();
  const sections = RARITIES.map((rarity) => {
    const cards = pool[rarity].filter((c) => !query || c.name.toLowerCase().includes(query));
    if (cards.length === 0) return '';
    return `
      <h3 class="codex-rarity-heading rarity-pill-${rarity}">${RARITY_LABELS[rarity]} <span class="codex-count">${cards.length}</span></h3>
      ${cards.map(codexRowHtml).join('')}
    `;
  }).join('');
  return sections.trim() ? sections : `<p class="modal-sub">No cards match "${encyclopediaQuery}".</p>`;
}

function openEncyclopediaModal() {
  const tabs = SEASONS.map(
    (season) =>
      `<button class="btn btn-small codex-tab-btn${season === encyclopediaSeason ? ' codex-tab-active' : ''}" data-season="${season}">${season}</button>`,
  ).join('');

  renderModal(`
    <h2>Card Encyclopedia</h2>
    <p class="modal-sub">Every card in ${SEASON_SET_NAME[encyclopediaSeason]}. Prices are rough estimates — actual sale price varies by season and buyer.</p>
    <div class="codex-tabs">${tabs}</div>
    <input type="text" id="codex-search" class="codex-search" placeholder="Search by name..." value="${encyclopediaQuery}" />
    <div class="codex-list" id="codex-list">${encyclopediaBodyHtml()}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.codex-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      encyclopediaSeason = btn.dataset.season as Season;
      openEncyclopediaModal();
    });
  });
  const searchInput = modalLayer.querySelector('#codex-search') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    encyclopediaQuery = searchInput.value;
    const list = modalLayer.querySelector('#codex-list')!;
    list.innerHTML = encyclopediaBodyHtml();
  });
  searchInput.focus();
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- HUD ---

function renderBagCount() {
  const el = document.getElementById('bag-count');
  if (el) el.textContent = String(gameState.inventory.length);
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
      <div class="hud-stat">❤ <span id="hp-value">${gameState.hp}</span>/<span id="max-hp-value">${gameState.maxHp}</span></div>
      <div class="hud-stat">Day <span id="day-value">${gameState.day}</span> &middot; <span id="season-value">${gameState.season}</span></div>
      <div id="festival-banner" class="festival-banner" ${gameState.isFestivalDay ? '' : 'hidden'}>🎉 Festival</div>
      <div class="hud-timebar"><div id="time-fill" class="time-fill"></div></div>
      <button id="bag-btn" class="btn btn-small">&#127890; Bag (<span id="bag-count">${gameState.inventory.length}</span>)</button>
      <button id="encyclopedia-btn" class="btn btn-small">&#128214; Cards</button>
      <button id="end-day-btn" class="btn btn-small">End Day</button>
    </div>
    <div id="modal-layer"></div>
  `;
  modalLayer = root.querySelector('#modal-layer') as HTMLDivElement;

  document.getElementById('end-day-btn')!.addEventListener('click', () => {
    gameState.endDay();
  });
  document.getElementById('bag-btn')!.addEventListener('click', openBagModal);
  document.getElementById('encyclopedia-btn')!.addEventListener('click', () => {
    encyclopediaSeason = gameState.season;
    openEncyclopediaModal();
  });

  renderSeasonBadge();

  bus.on('gold-changed', (gold: number) => {
    document.getElementById('gold-value')!.textContent = String(gold);
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-pack-btn').forEach((btn) => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack);
      if (pack) btn.disabled = gold < effectivePackCost(pack);
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
      const def =
        SHOP_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key) ??
        TOWN_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key) ??
        COMBAT_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      if (def) btn.disabled = gold < def.cost;
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.unlock-zone-btn').forEach((btn) => {
      const zone = ZONE_DEFS.find((z) => z.id === btn.dataset.zone);
      if (zone) btn.disabled = gold < zone.unlockCost;
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
  bus.on('inventory-changed', renderBagCount);
  bus.on('hp-changed', (hp: number) => {
    const el = document.getElementById('hp-value');
    if (el) el.textContent = String(Math.round(hp));
  });
  bus.on('combat-upgrades-changed', () => {
    const el = document.getElementById('max-hp-value');
    if (el) el.textContent = String(gameState.maxHp);
  });
  bus.on('open-counter', openCounterModal);
  bus.on('open-shelf', (shelfId: string) => openShelfModal(shelfId));
  bus.on('day-summary', (summary: DaySummary) => openDaySummaryModal(summary));
  bus.on('open-townhall', openTownHallModal);
  bus.on('open-zonemap', openZoneMapModal);
  bus.on('open-npc', (npcId: string) => openNpcModal(npcId));
}
