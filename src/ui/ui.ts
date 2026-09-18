import {
  gameState,
  bus,
  WEAPON_TIER_DAMAGE_BONUS,
  VITALITY_TIER_HP_BONUS,
  SPEED_TIER_BONUS,
  MELEE_RANGE_TIER_BONUS,
  ATTACK_ARC_TIER_BONUS,
  SEASONS,
  ENERGY_TONIC_COST,
  ENERGY_TONIC_RESTORE,
  FIRST_AID_KIT_COST,
  FIRST_AID_KIT_HEAL,
  RANGED_TIER_DAMAGE_BONUS,
  RANGED_TIER_WINDUP_REDUCTION_MS,
  EXHAUSTED_HAGGLE_WALKAWAY_BONUS,
  PLAYER_BASE_ATTACK_DAMAGE,
  PLAYER_BASE_MAX_HP,
  type DaySummary,
} from '../game/state';
import { PACKS, openPack, type PackDefinition } from '../game/packs';
import { RARITIES, RARITY_LABELS, RARITY_BASE_VALUE, SEASON_PRICE_MULTIPLIER } from '../game/cards';
import { NPCS, friendshipTier, FRIENDSHIP_TIER_LABELS } from '../game/npcs';
import { cardArtHtml } from '../game/cardArt';
import { SEASON_SET_NAME, SEASON_CARD_POOL, STAGE_VALUE_MULTIPLIER, type SpeciesCard } from '../game/species';
import { ZONE_DEFS, type ZoneDef } from '../game/combat';
import { LEGACY_MILESTONES, LEGACY_CAPSTONE, type LegacyMilestone } from '../game/legacy';
import { priceReactionFor } from '../game/pricing';
import { playCardPop, playPackOpen, playLegendary, playChime, playCoin, playError } from '../game/audio';
import type { Card, ShopUpgrades, TownUpgrades, RecurringFees, CombatUpgrades, MovementUpgrades, Season, Rarity, BoardObjective, MerchantOffer } from '../game/types';
import { RECURRING_FEE_DEFS } from '../game/fees';
import { PRESTIGE_PERKS } from '../game/prestige';
import { OUTFITS, type OutfitDef } from '../game/outfits';
import { DECOR_ITEMS, type DecorDef } from '../game/decor';
import { FISH_SPECIES, type FishDef } from '../game/fishing';
import { PERKS, PERK_BRANCH_LABELS, type PerkBranch } from '../game/perks';
import { checkoutQueue, completeCheckout, walkAwayFromCheckout } from '../game/Customer';
import { showFloatingText } from '../game/fx';

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
  // The illustrated image may not exist yet (art is rolled out species by
  // species, sometimes stage by stage) — if it 404s, fall back through
  // generic species art, then to the procedural art beside it.
  const art = cardArtHtml(card.speciesId, card.stage, card.season, card.rarity, 'card-art-img', 'card-art-fallback');
  const stageBadge = card.stageCount > 1 ? `<div class="stage-badge">${card.stage}/${card.stageCount}</div>` : '';
  const setLine = small ? '' : `<div class="card-set-name">${SEASON_SET_NAME[card.season]}</div>`;
  const shinyBadge = card.shiny ? `<div class="shiny-badge">&#10022; Shiny</div>` : '';
  return `
    <div class="card-chip rarity-${card.rarity}${small ? ' card-chip-small' : ''}${card.shiny ? ' card-chip-shiny' : ''}">
      <div class="card-inner">
        <div class="card-name">${card.name}</div>
        <div class="card-art-window">${art}${stageBadge}${shinyBadge}</div>
        <div class="card-footer">
          <span class="card-rarity-pill rarity-pill-${card.rarity}">${RARITY_LABELS[card.rarity]}</span>
        </div>
        ${setLine}
      </div>
    </div>
  `;
}

// A card plus its current market value shown as a separate tag underneath —
// used wherever the player needs the value for a decision (unpacking).
function cardSlotHtml(card: Card, small = false): string {
  return `
    <div class="card-slot">
      ${cardChipHtml(card, small)}
      <div class="value-tag">${card.baseValue}g</div>
    </div>
  `;
}

// A single-line, compact row for picking a card out of a list (stocking a
// shelf, choosing a gift) — a thumbnail plus name/rarity, not a full card
// face, so a long list reads as an organized list instead of a wall of cards.
function compactCardRowHtml(card: Card, idx: number, trailingHtml: string, highlight = false): string {
  const requestTag = highlight ? `<div class="codex-request-tag">&#9733; Wanted!</div>` : '';
  return `
    <div class="codex-row${highlight ? ' codex-row-requested' : ''}" data-idx="${idx}">
      <div class="codex-thumb-wrap">${cardArtHtml(card.speciesId, card.stage, card.season, card.rarity, 'codex-thumb', 'codex-thumb-fallback')}</div>
      <div class="codex-info">
        <div class="codex-name">${card.name}${card.shiny ? ' <span class="shiny-tag">&#10022;</span>' : ''}</div>
        <div class="codex-meta">${RARITY_LABELS[card.rarity]} &middot; base ${card.baseValue}g</div>
        ${requestTag}
      </div>
      ${trailingHtml}
    </div>
  `;
}

// Every modal gets the same top-corner X regardless of which tab/screen is
// open — "close everything" shouldn't depend on hunting down that screen's
// own Close/Cancel button. Most modals can just fully close; the pack
// reveal and the haggle minigame pass their own onCloseX so bailing early
// still banks the cards / settles the sale instead of losing it outright.
// Escape (see initUI) runs this same handler, not a bare closeModal, so it
// can't be used to dodge that cleanup either.
let activeCloseHandler: () => void = () => {};

function renderModal(inner: string, onCloseX: () => void = closeModal) {
  modalLayer.innerHTML = `<div class="modal-backdrop"><div class="modal"><button class="modal-x-btn" aria-label="Close">&times;</button>${inner}</div></div>`;
  activeCloseHandler = onCloseX;
  modalLayer.querySelector('.modal-x-btn')!.addEventListener('click', onCloseX);
  gameState.setPaused(true);
}

function closeModal() {
  modalLayer.innerHTML = '';
  activeCloseHandler = () => {};
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
  // Bag-capacity upgrades (bagTier1/bagTier2) are intentionally not sold —
  // the bag no longer limits how many cards you can hold. The upgrades and
  // gameState.bagCapacity still exist for whatever non-card items show up
  // later; they're just not worth gold to buy while nothing uses them yet.
  {
    key: 'shopClerk',
    name: 'Hire a Shop Clerk',
    cost: 1000,
    description: 'Sells one stocked shelf on its own every so often — even while you\'re off in the Wilds or Town.',
  },
  {
    key: 'autoRestocker',
    name: "Clerk's Assistant",
    cost: 600,
    description: 'Whenever the clerk empties a shelf, restocks it from your bag automatically.',
    requiresKey: 'shopClerk',
  },
];

interface TownUpgradeDef {
  key: keyof TownUpgrades;
  name: string;
  cost: number;
  description: string;
}

const TOWN_UPGRADE_DEFS: TownUpgradeDef[] = [
  { key: 'fountainRepaired', name: 'Repair the Fountain', cost: 250, description: 'Talking to townsfolk earns a bit more friendship, and unlocks fishing at the fountain.' },
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
  {
    key: 'weaponTier4',
    name: 'Sharpen Weapon IV',
    cost: 1800,
    description: `+${WEAPON_TIER_DAMAGE_BONUS} more attack damage.`,
    requiresKey: 'weaponTier3',
  },
  {
    key: 'weaponTier5',
    name: 'Sharpen Weapon V',
    cost: 3500,
    description: `+${WEAPON_TIER_DAMAGE_BONUS} more attack damage — Frostback-ready.`,
    requiresKey: 'weaponTier4',
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
  {
    key: 'vitalityTier4',
    name: 'Vitality IV',
    cost: 1800,
    description: `+${VITALITY_TIER_HP_BONUS} more max HP.`,
    requiresKey: 'vitalityTier3',
  },
  {
    key: 'vitalityTier5',
    name: 'Vitality V',
    cost: 3500,
    description: `+${VITALITY_TIER_HP_BONUS} more max HP — Frostback-ready.`,
    requiresKey: 'vitalityTier4',
  },
  {
    key: 'attackRangeTier1',
    name: 'Reach I',
    cost: 300,
    description: `Longer, wider attack swing: +${MELEE_RANGE_TIER_BONUS} range and +${ATTACK_ARC_TIER_BONUS}° arc.`,
  },
  {
    key: 'attackRangeTier2',
    name: 'Reach II',
    cost: 1200,
    description: `Even longer, wider swing: +${MELEE_RANGE_TIER_BONUS} more range and +${ATTACK_ARC_TIER_BONUS}° more arc.`,
    requiresKey: 'attackRangeTier1',
  },
];

interface MovementUpgradeDef {
  key: keyof MovementUpgrades;
  name: string;
  cost: number;
  description: string;
  requiresKey?: keyof MovementUpgrades;
}

const MOVEMENT_UPGRADE_DEFS: MovementUpgradeDef[] = [
  { key: 'speedTier1', name: 'Worn-in Boots', cost: 120, description: `+${SPEED_TIER_BONUS} move speed everywhere.` },
  {
    key: 'speedTier2',
    name: 'Featherweight Boots',
    cost: 350,
    description: `+${SPEED_TIER_BONUS} more move speed.`,
    requiresKey: 'speedTier1',
  },
  {
    key: 'speedTier3',
    name: 'Windwalker Boots',
    cost: 800,
    description: `+${SPEED_TIER_BONUS} more move speed.`,
    requiresKey: 'speedTier2',
  },
  {
    key: 'speedTier4',
    name: 'Gale-Step Boots',
    cost: 1800,
    description: `+${SPEED_TIER_BONUS} more move speed.`,
    requiresKey: 'speedTier3',
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

// Recurring fees read differently from a one-time upgrade: the "buy" button
// permanently waives a weekly charge rather than granting something new, so
// it gets its own row shape (weekly cost shown, "Paid Off" instead of
// "Owned") rather than reusing upgradeRowHtml's wording.
function feeRowHtml(key: keyof RecurringFees): string {
  const def = RECURRING_FEE_DEFS.find((d) => d.key === key)!;
  const waived = gameState.recurringFees[key];
  const buttonHtml = waived
    ? `<button class="btn btn-secondary" disabled>Paid Off</button>`
    : `<button class="btn buy-upgrade-btn" data-key="${key}" ${gameState.gold < def.payoffCost ? 'disabled' : ''}>Pay Off ${def.payoffCost}g</button>`;
  return `
    <div class="pack-row">
      <div class="pack-info">
        <div class="pack-name">${def.name}${waived ? ' — waived' : ` — ${def.weeklyCost}g/week`}</div>
        <div class="pack-meta">${def.description}</div>
      </div>
      ${buttonHtml}
    </div>
  `;
}

// Shop upgrades are ordered here, not bought outright — they're a
// Distributor good like packs, so the row needs its own "on order" state
// instead of the generic owned/locked/buy shape upgradeRowHtml() covers.
function shopUpgradesHtml(): string {
  return SHOP_UPGRADE_DEFS.map((def) => {
    const owned = gameState.shopUpgrades[def.key];
    const pending = gameState.pendingShopUpgrades.includes(def.key);
    const requirementMet = !def.requiresKey || gameState.shopUpgrades[def.requiresKey] || gameState.pendingShopUpgrades.includes(def.requiresKey);
    const locked = !requirementMet;
    let buttonHtml: string;
    if (owned) {
      buttonHtml = `<button class="btn btn-secondary" disabled>Owned</button>`;
    } else if (pending) {
      buttonHtml = `<button class="btn btn-secondary" disabled>Ordered</button>`;
    } else if (locked) {
      buttonHtml = `<button class="btn btn-secondary" disabled>Locked</button>`;
    } else {
      buttonHtml = `<button class="btn order-upgrade-btn" data-key="${def.key}" ${gameState.gold < def.cost ? 'disabled' : ''}>${def.cost}g</button>`;
    }
    return `
      <div class="pack-row">
        <div class="pack-info">
          <div class="pack-name">${def.name}</div>
          <div class="pack-meta">${def.description}</div>
        </div>
        ${buttonHtml}
      </div>
    `;
  }).join('');
}

// --- Packs on hand: ready to open now (combat drops, or a purchase that
// matured overnight), and pending (bought today, arriving tomorrow) ---

function packCountRows(packIds: string[], ready: boolean): string {
  const counts = new Map<string, number>();
  for (const id of packIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => {
      const pack = PACKS.find((p) => p.id === id);
      if (!pack) return '';
      const actions = ready
        ? `<div class="pack-actions-col">
             <button class="btn btn-small open-owned-pack-btn" data-pack="${id}">Open</button>
             ${count > 1 ? `<button class="btn btn-small btn-secondary open-all-owned-btn" data-pack="${id}">Open All &times;${count}</button>` : ''}
             <button class="btn btn-small btn-secondary sell-owned-pack-btn" data-pack="${id}">Sell ${pack.sellValue}g</button>
           </div>`
        : `<span class="pack-pending-tag">Arrives tomorrow</span>`;
      return `
        <div class="pack-row${ready ? '' : ' pack-row-pending'}">
          <div class="pack-swatch" style="background:${colorToCss(pack.color)}"></div>
          <div class="pack-info">
            <div class="pack-name">${pack.name}${count > 1 ? ` &times;${count}` : ''}</div>
            <div class="pack-meta">${pack.cardCount} cards &middot; ${SEASON_SET_NAME[gameState.season]}</div>
          </div>
          ${actions}
        </div>
      `;
    })
    .join('');
}

function ownedPacksHtml(): string {
  return gameState.ownedPacks.length > 0
    ? `<div class="pack-list">${packCountRows(gameState.ownedPacks, true)}</div>`
    : `<p class="modal-sub">No packs ready to open yet — order one at the Distributor (it'll be here tomorrow), or defeat enemies in the Wilds for an instant one.</p>`;
}

// What's currently on order at the Distributor and not here yet — packs and
// shop upgrades alike, since neither is available same-day any more.
function pendingArrivalsHtml(): string {
  const packsSection = gameState.pendingPacks.length > 0 ? `<div class="pack-list">${packCountRows(gameState.pendingPacks, false)}</div>` : '';
  const upgradesSection =
    gameState.pendingShopUpgrades.length > 0
      ? `<div class="pack-list">${gameState.pendingShopUpgrades
          .map((key) => {
            const def = SHOP_UPGRADE_DEFS.find((d) => d.key === key)!;
            return `
              <div class="pack-row pack-row-pending">
                <div class="pack-info"><div class="pack-name">${def.name}</div></div>
                <span class="pack-pending-tag">Installing tomorrow</span>
              </div>
            `;
          })
          .join('')}</div>`
      : '';
  if (!packsSection && !upgradesSection) return `<p class="modal-sub">Nothing on order right now.</p>`;
  return packsSection + upgradesSection;
}

// --- Distributor (packs and shop upgrades — everything that used to be
// bought at the player's own shop counter) ---

// The player's own register — managing packs already on hand (open/sell)
// and, when someone's waiting, ringing up a sale. No buying happens here
// any more; that's all at the Distributor now.
function openCounterModal() {
  renderModal(`
    <h2>Register</h2>
    <h2 class="modal-section-title">Your Packs</h2>
    ${ownedPacksHtml()}
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.open-owned-pack-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const packId = btn.dataset.pack!;
      const pack = PACKS.find((p) => p.id === packId) as PackDefinition;
      if (!gameState.consumeOwnedPack(packId)) return;
      gameState.notePackOpened();
      const forceShinyOnce = gameState.consumeShinyCharm();
      const cards = openPack(pack, gameState.season, { forceShinyOnce });
      openPackRevealModal(pack, cards);
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.open-all-owned-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack) as PackDefinition;
      bulkOpenAndReveal(pack);
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
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// Everything you'd buy for the shop — packs, provisions, upgrades — now
// lives here instead, and nothing ordered shows up before tomorrow.
function openDistributorModal() {
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
        <button class="btn btn-small buy-pack-btn" data-pack="${p.id}" ${gameState.gold < cost ? 'disabled' : ''} title="Arrives tomorrow">${cost}g</button>
      </div>
    `;
  }).join('');

  const daysLeft = gameState.daysLeftInSeason;
  const seasonWarning =
    daysLeft <= 1
      ? `<br><strong class="season-countdown-urgent">${daysLeft === 0 ? "Last day for this set!" : "1 day left for this set!"}</strong> ${SEASON_SET_NAME[gameState.season]} rotates out once the season ends.`
      : `<br><span class="season-countdown">${daysLeft} days left</span> before ${SEASON_SET_NAME[gameState.season]} rotates out for the season.`;

  const rep = gameState.reputationTier;
  const nextRep = gameState.nextReputationTier;
  const repLine = nextRep
    ? `<strong>${rep.name}</strong> &middot; ${nextRep.minSales - gameState.lifetimeCardsSold} more lifetime sale${nextRep.minSales - gameState.lifetimeCardsSold === 1 ? '' : 's'} to reach ${nextRep.name}`
    : `<strong>${rep.name}</strong> &middot; the shop's reputation is maxed out`;

  renderModal(`
    <h2>Distributor</h2>
    <p class="modal-sub">
      Now stocking <strong>${SEASON_SET_NAME[gameState.season]}</strong>. Everything here ships overnight — packs, provisions,
      and upgrades alike are never available same-day.
      ${multiplier !== 1 ? `<br><strong>${gameState.season} market:</strong> pack prices &times;${multiplier}.` : ''}
      ${seasonWarning}
    </p>
    <h2 class="modal-section-title">Order Packs</h2>
    <div class="pack-list">${packRows}</div>
    <h2 class="modal-section-title">Arriving Tomorrow</h2>
    ${pendingArrivalsHtml()}
    <h2 class="modal-section-title">Shop Upgrades</h2>
    <div class="pack-list">${shopUpgradesHtml()}</div>
    <h2 class="modal-section-title">Shop Reputation</h2>
    <p class="modal-sub reputation-line">${repLine}</p>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-pack-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack) as PackDefinition;
      if (!gameState.buyPackPending(pack.id, effectivePackCost(pack))) return;
      playChime();
      openDistributorModal();
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.order-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const def = SHOP_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key)!;
      if (!gameState.orderShopUpgrade(def.key, def.cost)) return;
      playChime();
      openDistributorModal();
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- General Store (provisions bought here take effect instantly, plus
// the ranged weapon unlock) ---

const RANGED_WEAPON_COST = 900;

interface RangedUpgradeDef {
  key: 'rangedTier1' | 'rangedTier2';
  name: string;
  cost: number;
  description: string;
  requiresKey: keyof CombatUpgrades;
}

const RANGED_UPGRADE_DEFS: RangedUpgradeDef[] = [
  {
    key: 'rangedTier1',
    name: 'Reinforced Bolts',
    cost: 1100,
    description: `+${RANGED_TIER_DAMAGE_BONUS.toFixed(1)}x damage multiplier, -${RANGED_TIER_WINDUP_REDUCTION_MS}ms wind-up.`,
    requiresKey: 'rangedWeaponUnlocked',
  },
  {
    key: 'rangedTier2',
    name: 'Masterwork Bolts',
    cost: 2200,
    description: `+${RANGED_TIER_DAMAGE_BONUS.toFixed(1)}x more damage, -${RANGED_TIER_WINDUP_REDUCTION_MS}ms more wind-up.`,
    requiresKey: 'rangedTier1',
  },
];

function rangedUpgradeRowsHtml(): string {
  return RANGED_UPGRADE_DEFS.map((def) => {
    const owned = gameState.combatUpgrades[def.key];
    const locked = !gameState.combatUpgrades[def.requiresKey];
    return upgradeRowHtml(def.key, def.name, def.cost, def.description, owned, locked);
  }).join('');
}

function generalStoreProvisionsHtml(): string {
  const energyFull = gameState.energy >= gameState.maxEnergy;
  const canAffordDrink = gameState.gold >= ENERGY_TONIC_COST;
  const hpFull = gameState.hp >= gameState.maxHp;
  const canAffordKit = gameState.gold >= FIRST_AID_KIT_COST;
  return `
    <div class="pack-row">
      <div class="pack-swatch" style="background:#c0392b"></div>
      <div class="pack-info">
        <div class="pack-name">First Aid Kit</div>
        <div class="pack-meta">Heals ${FIRST_AID_KIT_HEAL} HP on the spot.</div>
      </div>
      <button class="btn buy-firstaid-btn" ${hpFull || !canAffordKit ? 'disabled' : ''} title="${hpFull ? 'HP already full' : ''}">${FIRST_AID_KIT_COST}g</button>
    </div>
    <div class="pack-row">
      <div class="pack-swatch" style="background:#7ee787"></div>
      <div class="pack-info">
        <div class="pack-name">Energy Drink</div>
        <div class="pack-meta">Restores ${ENERGY_TONIC_RESTORE} energy on the spot.</div>
      </div>
      <button class="btn buy-tonic-btn" ${energyFull || !canAffordDrink ? 'disabled' : ''} title="${energyFull ? 'Energy already full' : ''}">${ENERGY_TONIC_COST}g</button>
    </div>
  `;
}

function rangedWeaponRowHtml(): string {
  const owned = gameState.combatUpgrades.rangedWeaponUnlocked;
  const buttonHtml = owned
    ? `<button class="btn btn-secondary" disabled>Owned</button>`
    : `<button class="btn buy-ranged-btn" ${gameState.gold < RANGED_WEAPON_COST ? 'disabled' : ''}>${RANGED_WEAPON_COST}g</button>`;
  return `
    <div class="pack-row">
      <div class="pack-info">
        <div class="pack-name">Ranged Weapon</div>
        <div class="pack-meta">
          An alternate attack (press <strong>R</strong> in the Wilds) — rooted in place through a wind-up, but it hits far
          harder than your melee swing once it lands.
        </div>
      </div>
      ${buttonHtml}
    </div>
  `;
}

function openGeneralStoreModal() {
  renderModal(`
    <h2>General Store</h2>
    <p class="modal-sub">Adventuring gear — everything here works the instant you buy it, unlike the Distributor's overnight orders.</p>
    <h2 class="modal-section-title">Provisions</h2>
    <div class="pack-list">${generalStoreProvisionsHtml()}</div>
    <h2 class="modal-section-title">Weapons</h2>
    <div class="pack-list">${rangedWeaponRowHtml()}${rangedUpgradeRowsHtml()}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const def = RANGED_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key)!;
      if (!gameState.purchaseCombatUpgrade(def.key, def.cost)) return;
      playChime();
      openGeneralStoreModal();
    });
  });
  modalLayer.querySelector('.buy-firstaid-btn')?.addEventListener('click', () => {
    if (!gameState.useFirstAidKit(FIRST_AID_KIT_COST, FIRST_AID_KIT_HEAL)) return;
    playChime();
    openGeneralStoreModal();
  });
  modalLayer.querySelector('.buy-tonic-btn')?.addEventListener('click', () => {
    if (!gameState.buyEnergyTonic(ENERGY_TONIC_COST, ENERGY_TONIC_RESTORE)) return;
    playChime();
    openGeneralStoreModal();
  });
  modalLayer.querySelector('.buy-ranged-btn')?.addEventListener('click', () => {
    if (!gameState.purchaseCombatUpgrade('rangedWeaponUnlocked', RANGED_WEAPON_COST)) return;
    playChime();
    openGeneralStoreModal();
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Haggling (the register) ---
//
// A customer at the register opens with a lowball offer, not the sticker
// price — the player either takes it or pushes back for more, round by
// round, with a real chance each push-back blows the sale entirely. Pricing
// a shelf high is a bet that it's worth haggling down from, not a
// guaranteed payout.

const MAX_HAGGLE_ROUNDS = 3;

const HAGGLE_INITIAL_RATIO: Record<'normal' | 'bulkBuyer' | 'bigSpender', [number, number]> = {
  normal: [0.45, 0.6],
  bulkBuyer: [0.5, 0.6],
  bigSpender: [0.65, 0.8],
};

const HAGGLE_WALKAWAY_CHANCE: Record<'normal' | 'bulkBuyer' | 'bigSpender', number> = {
  normal: 0.22,
  bulkBuyer: 0.18,
  bigSpender: 0.08,
};

const HAGGLE_PUSHBACK_LINES = [
  'They grumble, but come up a bit.',
  'Fine, fine — a little more.',
  'They sigh and sweeten the offer.',
  "Alright, alright, here's more.",
];

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function openHaggleModal(ticketId: number) {
  const ticket = checkoutQueue.find((t) => t.id === ticketId);
  if (!ticket) return;
  // Aliased to a definitely-non-null const — `ticket` itself loses its
  // narrowed type inside the nested function declarations below.
  const t = ticket;

  const [minRatio, maxRatio] = HAGGLE_INITIAL_RATIO[t.archetype];
  let offer = Math.max(1, Math.round(t.price * (minRatio + Math.random() * (maxRatio - minRatio))));
  let round = 1;
  let settled = false;

  const finish = (finalPrice: number | null) => {
    if (settled) return;
    settled = true;
    if (finalPrice != null) {
      playCoin();
      completeCheckout(t.id, finalPrice);
    } else {
      playError();
      walkAwayFromCheckout(t.id);
    }
    closeModal();
  };

  const render = (feedback = '') => {
    const atFinalRound = round > MAX_HAGGLE_ROUNDS;
    const gap = t.price - offer;
    const actionsHtml = atFinalRound
      ? `<button class="btn haggle-accept-btn">Accept ${offer}g (final offer)</button>`
      : gap <= 0
        ? `<button class="btn haggle-accept-btn">Accept ${offer}g</button>`
        : `<button class="btn haggle-accept-btn">Accept ${offer}g</button><button class="btn btn-secondary haggle-pushback-btn">Push Back</button>`;

    renderModal(
      `
      <h2>Haggling</h2>
      <p class="modal-sub">${t.card.name} — listed at ${t.price}g.</p>
      <p class="modal-sub haggle-offer-line">Their offer: <strong>${offer}g</strong>${atFinalRound ? ' — take it or leave it.' : ''}</p>
      ${feedback ? `<p class="modal-sub haggle-feedback">${feedback}</p>` : ''}
      <div class="modal-actions">${actionsHtml}</div>
      `,
      // Walking away from the modal itself (X or Escape) just takes
      // whatever's currently on the table — no punitive default beyond that.
      () => finish(offer),
    );

    modalLayer.querySelector('.haggle-accept-btn')!.addEventListener('click', () => finish(offer));
    modalLayer.querySelector('.haggle-pushback-btn')?.addEventListener('click', () => {
      round += 1;
      const walkAwayChance = HAGGLE_WALKAWAY_CHANCE[t.archetype] + (gameState.isExhausted ? EXHAUSTED_HAGGLE_WALKAWAY_BONUS : 0);
      if (Math.random() < walkAwayChance) {
        showFloatingText(t.scene, t.sprite.x, t.sprite.y - 20, `That's insulting.`, '#c92a2a');
        finish(null);
        return;
      }
      offer = Math.min(t.price, offer + Math.round(gap * (0.4 + Math.random() * 0.2)));
      render(pickOne(HAGGLE_PUSHBACK_LINES));
    });
  };

  render();
}

// Matches the rarity-pill colors elsewhere in the UI, used here as a glow
// behind each card as it's revealed — bigger and warmer for rarer pulls.
const REVEAL_GLOW_COLOR: Record<Rarity, string> = {
  common: '#5aa8d9',
  uncommon: '#4fb85c',
  rare: '#cf9a26',
  epic: '#9c4fd9',
  legendary: '#d93e3e',
};

/** Opens every remaining owned copy of a pack at once and feeds all their
 * cards into one combined reveal, instead of making the player click
 * "Open" over and over. */
function bulkOpenAndReveal(pack: PackDefinition) {
  const allCards: Card[] = [];
  while (gameState.consumeOwnedPack(pack.id)) {
    gameState.notePackOpened();
    const forceShinyOnce = gameState.consumeShinyCharm();
    allCards.push(...openPack(pack, gameState.season, { forceShinyOnce }));
  }
  if (allCards.length === 0) return;
  openPackRevealModal(pack, allCards);
}

function openPackRevealModal(pack: PackDefinition, cards: Card[]) {
  const season = cards[0]?.season ?? gameState.season;
  // Reveal worst-to-best — classic pack-opening suspense, saving the best
  // pull (if there is one) for last regardless of the order it was rolled in.
  const order = [...cards].sort((a, b) => RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));

  renderModal(`
    <h2>${pack.name} Opened!</h2>
    <p class="modal-sub">${SEASON_SET_NAME[season]}</p>
    <div class="reveal-stage" id="reveal-stage"></div>
    <div class="reveal-progress" id="reveal-progress">
      ${order.map(() => `<div class="reveal-pip"></div>`).join('')}
    </div>
    <div class="reveal-grid reveal-grid-small" id="reveal-grid" hidden></div>
    <div class="modal-actions" id="reveal-actions"></div>
  `,
    () => {
      // Bailing out via the corner X mid-reveal still banks whatever this
      // pack rolled — only a real "Collect" click is supposed to gate that
      // in the normal flow, but losing pulled cards to an X click would be
      // a nasty surprise.
      gameState.addCardsToInventory(cards);
      closeModal();
    },
  );

  const stage = modalLayer.querySelector('#reveal-stage') as HTMLDivElement;
  const progress = modalLayer.querySelector('#reveal-progress') as HTMLDivElement;
  const pips = progress.querySelectorAll<HTMLDivElement>('.reveal-pip');
  const grid = modalLayer.querySelector('#reveal-grid') as HTMLDivElement;
  const actionsBox = modalLayer.querySelector('#reveal-actions') as HTMLDivElement;

  let idx = 0;

  function spotlight(card: Card): boolean {
    const bigMoment = card.rarity === 'legendary' || card.shiny;
    const wrap = document.createElement('div');
    wrap.className = 'card-spotlight';
    if (card.rarity === 'epic' || card.rarity === 'legendary') {
      wrap.classList.add('card-spotlight-flourish');
    }
    if (bigMoment) {
      wrap.classList.add('card-spotlight-big-moment');
    }
    wrap.style.setProperty('--glow', REVEAL_GLOW_COLOR[card.rarity]);
    wrap.innerHTML = cardSlotHtml(card);

    if (bigMoment) {
      const flash = document.createElement('div');
      flash.className = 'reveal-flash';
      stage.replaceChildren(flash, wrap);
      playLegendary();
    } else {
      stage.replaceChildren(wrap);
      playCardPop();
    }

    const pip = pips[order.indexOf(card)];
    pip.style.setProperty('--pip-color', REVEAL_GLOW_COLOR[card.rarity]);
    pip.classList.add('reveal-pip-done');
    return bigMoment;
  }

  function finish() {
    stage.hidden = true;
    progress.hidden = true;
    grid.hidden = false;
    // Small chips here so a big haul (especially after "Open All") is all
    // visible at once instead of needing to scroll through full-size cards.
    grid.innerHTML = order.map((c) => cardSlotHtml(c, true)).join('');

    const remaining = gameState.ownedPacks.filter((id) => id === pack.id).length;
    if (remaining > 0) {
      actionsBox.innerHTML = `
        <button class="btn open-all-remaining-btn">Open All Remaining (${remaining})</button>
        <button class="btn btn-secondary collect-stop-btn">Collect &amp; Stop</button>
      `;
      actionsBox.querySelector('.open-all-remaining-btn')!.addEventListener('click', () => {
        gameState.addCardsToInventory(cards);
        bulkOpenAndReveal(pack);
      });
      actionsBox.querySelector('.collect-stop-btn')!.addEventListener('click', () => {
        gameState.addCardsToInventory(cards);
        openCounterModal();
      });
    } else {
      actionsBox.innerHTML = `<button class="btn collect-btn">Collect Cards</button>`;
      actionsBox.querySelector('.collect-btn')!.addEventListener('click', () => {
        gameState.addCardsToInventory(cards);
        openCounterModal();
      });
    }
  }

  // User-paced instead of auto-advancing on a timer — "Open Next" reveals
  // one card per click, "Close" jumps straight to the collected-cards grid,
  // so a big haul doesn't force you to sit through every card's delay.
  function renderRevealActions() {
    const isLast = idx >= order.length;
    actionsBox.innerHTML = isLast
      ? `<button class="btn open-next-btn">Collect Cards</button>`
      : `<button class="btn open-next-btn">Open Next</button><button class="btn btn-secondary close-reveal-btn">Close</button>`;
    actionsBox.querySelector('.open-next-btn')!.addEventListener('click', () => {
      if (isLast) finish();
      else revealNext();
    });
    actionsBox.querySelector('.close-reveal-btn')?.addEventListener('click', finish);
  }

  function revealNext() {
    if (idx >= order.length) {
      finish();
      return;
    }
    spotlight(order[idx]);
    idx += 1;
    renderRevealActions();
  }

  playPackOpen();
  revealNext();
}

// --- Shelf ---

// A live "how will customers see this price" readout, shared by both the
// reprice field on a stocked shelf and each price input while stocking one —
// same thresholds customers actually react with (pricing.ts), shown as a
// preview instead of the player having to guess and find out from a customer.
function priceBadgeHtml(baseValue: number, price: number): string {
  const ratio = price / Math.max(1, baseValue);
  const tier = priceReactionFor(ratio);
  return `<span class="price-badge ${tier.cssClass}">${tier.label}</span>`;
}

function updatePriceBadge(badge: HTMLElement, baseValue: number, price: number) {
  const ratio = price / Math.max(1, baseValue);
  const tier = priceReactionFor(ratio);
  badge.className = `price-badge ${tier.cssClass}`;
  badge.textContent = tier.label;
}

function openShelfModal(shelfId: string) {
  const shelf = gameState.shelves.find((s) => s.id === shelfId)!;
  let bodyHtml: string;

  if (shelf.card) {
    const baseValue = shelf.card.baseValue;
    bodyHtml = `
      <div class="reveal-grid">${cardSlotHtml(shelf.card)}</div>
      <p class="modal-sub">Customers open with a lowball offer and haggle up from there — price it high expecting to get talked down some.</p>
      <label class="field-label">Price
        <input type="number" id="reprice-input" min="1" value="${shelf.price}" />
      </label>
      ${priceBadgeHtml(baseValue, shelf.price)}
      <div class="modal-actions">
        <button class="btn update-price-btn">Update Price</button>
        <button class="btn btn-secondary remove-card-btn">Remove to Bag</button>
      </div>
    `;
  } else if (gameState.inventory.length === 0) {
    bodyHtml = `<p class="modal-sub">This shelf is empty, and your bag has no cards. Buy a pack at the counter!</p>`;
  } else {
    const items = gameState.inventory
      .map((c, idx) =>
        compactCardRowHtml(
          c,
          idx,
          `<div class="place-price-col">
             <input type="number" class="place-price-input" min="1" value="${c.baseValue}" />
             ${priceBadgeHtml(c.baseValue, c.baseValue)}
           </div>
           <button class="btn btn-small place-btn" data-idx="${idx}">Place</button>`,
        ),
      )
      .join('');
    bodyHtml = `<div class="codex-list">${items}</div>`;
  }

  renderModal(`
    <h2>Shelf</h2>
    ${bodyHtml}
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  if (shelf.card) {
    const baseValue = shelf.card.baseValue;
    const repriceInput = modalLayer.querySelector('#reprice-input') as HTMLInputElement;
    const badge = modalLayer.querySelector('.price-badge') as HTMLElement;
    repriceInput.addEventListener('input', () => {
      updatePriceBadge(badge, baseValue, Number(repriceInput.value) || 0);
    });
    modalLayer.querySelector('.update-price-btn')!.addEventListener('click', () => {
      gameState.repriceShelf(shelfId, Number(repriceInput.value));
      closeModal();
    });
    modalLayer.querySelector('.remove-card-btn')!.addEventListener('click', () => {
      gameState.clearShelf(shelfId);
      closeModal();
    });
  } else {
    modalLayer.querySelectorAll<HTMLElement>('.codex-row').forEach((row) => {
      const idx = Number(row.dataset.idx);
      const card = gameState.inventory[idx];
      const priceInput = row.querySelector('.place-price-input') as HTMLInputElement;
      const badge = row.querySelector('.price-badge') as HTMLElement;
      priceInput.addEventListener('input', () => {
        updatePriceBadge(badge, card.baseValue, Number(priceInput.value) || 0);
      });
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.place-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx);
        const card = gameState.inventory[idx];
        const row = btn.closest('.codex-row') as HTMLElement;
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
  const packsLine =
    summary.packsArrived > 0
      ? `<br>&#127873; ${summary.packsArrived} pack${summary.packsArrived === 1 ? '' : 's'} arrived overnight — ready at the counter.`
      : '';
  const upgradesLine =
    summary.upgradesArrived > 0
      ? `<br>&#128230; ${summary.upgradesArrived} upgrade${summary.upgradesArrived === 1 ? '' : 's'} installed overnight — courtesy of the Distributor.`
      : '';
  const feesLine =
    summary.feesCharged > 0
      ? `<br>&#128179; This week's bill: <strong>${summary.feesCharged}g</strong> (${summary.feeNames.join(', ')}). Pay fees off for good at Town Hall.`
      : '';
  renderModal(`
    <h2>Day ${summary.day} Complete!</h2>
    <p class="modal-sub">${SEASON_SET_NAME[summary.season]} &middot; Earned <strong>${summary.goldEarned}g</strong> from ${summary.cardsSold} sale${summary.cardsSold === 1 ? '' : 's'}.${packsLine}${upgradesLine}${feesLine}</p>
    <button class="btn start-day-btn">Start Day ${summary.day + 1}</button>
  `);
  modalLayer.querySelector('.start-day-btn')!.addEventListener('click', closeModal);
}

// --- Town Board (daily objectives, posted at the Town Hall) ---

function townBoardRowHtml(obj: BoardObjective): string {
  const progress = Math.min(gameState.boardObjectiveProgress(obj), obj.target);
  const done = progress >= obj.target;
  const pct = (progress / obj.target) * 100;
  const actionHtml = obj.claimed
    ? `<span class="board-claimed-tag">&#10003; Claimed</span>`
    : `<button class="btn btn-small claim-board-btn" data-id="${obj.id}" ${done ? '' : 'disabled'}>${done ? `Claim ${obj.reward}g` : `${obj.reward}g`}</button>`;
  return `
    <div class="legacy-row${done ? ' legacy-row-done' : ''}">
      <div class="legacy-info">
        <div class="legacy-name">${obj.description}</div>
        <div class="legacy-bar"><div class="legacy-bar-fill" style="width:${pct}%"></div></div>
        <div class="legacy-progress-label">${progress} / ${obj.target}</div>
      </div>
      ${actionHtml}
    </div>
  `;
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

  const movementRows = MOVEMENT_UPGRADE_DEFS.map((def) => {
    const owned = gameState.movementUpgrades[def.key];
    const locked = !!def.requiresKey && !gameState.movementUpgrades[def.requiresKey];
    return upgradeRowHtml(def.key, def.name, def.cost, def.description, owned, locked);
  }).join('');

  const feeRows = RECURRING_FEE_DEFS.map((def) => feeRowHtml(def.key)).join('');

  renderModal(`
    <h2>Town Hall</h2>
    <p class="modal-sub">Invest your gold back into the town.</p>
    <h2 class="modal-section-title">Town Board — today's objectives</h2>
    <p class="modal-sub">Rerolls at the end of every day — unclaimed rewards don't carry over.</p>
    <div class="legacy-list">${gameState.townBoard.map(townBoardRowHtml).join('')}</div>
    <h2 class="modal-section-title">Weekly Bills</h2>
    <p class="modal-sub">Due every 7th day, whether or not the shop sold anything &mdash; currently <strong>${gameState.weeklyFeeTotal}g/week</strong>. Pay a fee off once here and it's gone for good.</p>
    <div class="pack-list">${feeRows}</div>
    <h2 class="modal-section-title">Town Upgrades</h2>
    <div class="pack-list">${rows}</div>
    <h2 class="modal-section-title">Adventuring Upgrades</h2>
    <p class="modal-sub">Attack: ${gameState.attackDamage} &middot; Max HP: ${gameState.maxHp}</p>
    <div class="pack-list">${combatRows}</div>
    <h2 class="modal-section-title">Movement Upgrades</h2>
    <p class="modal-sub">Move speed: ${gameState.moveSpeed}</p>
    <div class="pack-list">${movementRows}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.claim-board-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!gameState.claimBoardObjective(btn.dataset.id!)) return;
      playChime();
      openTownHallModal();
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const townDef = TOWN_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      const combatDef = COMBAT_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      const movementDef = MOVEMENT_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      const feeDef = RECURRING_FEE_DEFS.find((d) => d.key === btn.dataset.key);
      if (townDef) {
        gameState.purchaseTownUpgrade(townDef.key, townDef.cost);
      } else if (combatDef) {
        gameState.purchaseCombatUpgrade(combatDef.key, combatDef.cost);
      } else if (movementDef) {
        gameState.purchaseMovementUpgrade(movementDef.key, movementDef.cost);
      } else if (feeDef) {
        gameState.payOffFee(feeDef.key, feeDef.payoffCost);
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
    const geared = gameState.attackDamage >= zone.recommendedAttack && gameState.maxHp >= zone.recommendedHp;
    const powerLineHtml =
      zone.recommendedAttack > PLAYER_BASE_ATTACK_DAMAGE || zone.recommendedHp > PLAYER_BASE_MAX_HP
        ? `<div class="zone-power-line${geared ? ' zone-power-ready' : ' zone-power-under'}">
            Recommended: ${zone.recommendedAttack} attack / ${zone.recommendedHp} HP
            (you have ${gameState.attackDamage} / ${gameState.maxHp})${geared ? ' &#10003;' : ' — upgrade first!'}
          </div>`
        : '';
    return `
      <div class="pack-row">
        <div class="pack-info">
          <div class="pack-name">${zone.name}${current ? ' (current)' : ''}</div>
          <div class="pack-meta">${zone.description}</div>
          ${powerLineHtml}
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
      const zone = ZONE_DEFS.find((z) => z.id === btn.dataset.zone)!;
      const geared = gameState.attackDamage >= zone.recommendedAttack && gameState.maxHp >= zone.recommendedHp;
      if (geared) {
        enterZone(zone.id);
      } else {
        confirmUnderGearedEntry(zone);
      }
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

function enterZone(zoneId: string) {
  gameState.travelToZone(zoneId);
  closeModal();
  bus.emit('enter-wilds');
}

/** Shown instead of walking straight in when a zone's recommended gear
 * outstrips the player's — attacks there deal no damage until upgraded, so
 * this is the "you'll notice, don't say we didn't warn you" checkpoint. */
function confirmUnderGearedEntry(zone: ZoneDef) {
  renderModal(
    `
    <h2>Under-geared</h2>
    <p class="modal-sub">
      You're under-geared for ${zone.name} (recommended ${zone.recommendedAttack} attack / ${zone.recommendedHp} HP,
      you have ${gameState.attackDamage} / ${gameState.maxHp}). Your attacks will deal <strong>no damage</strong> until
      you upgrade enough. Enter anyway?
    </p>
    <div class="modal-actions">
      <button class="btn enter-anyway-btn">Enter Anyway</button>
      <button class="btn btn-secondary close-btn">Cancel</button>
    </div>
  `,
    openZoneMapModal,
  );
  modalLayer.querySelector('.enter-anyway-btn')!.addEventListener('click', () => enterZone(zone.id));
  modalLayer.querySelector('.close-btn')!.addEventListener('click', openZoneMapModal);
}

// --- Traveling merchant ---

function merchantOfferRowHtml(offer: MerchantOffer): string {
  const actionHtml = offer.purchased
    ? `<span class="board-claimed-tag">&#10003; Bought</span>`
    : `<button class="btn btn-small buy-merchant-btn" data-id="${offer.id}" ${gameState.gold < offer.cost ? 'disabled' : ''}>${offer.cost}g</button>`;
  return `
    <div class="pack-row">
      <div class="pack-info">
        <div class="pack-name">${offer.name}</div>
        <div class="pack-meta">${offer.description}</div>
      </div>
      ${actionHtml}
    </div>
  `;
}

function openMerchantModal() {
  const visit = gameState.merchantVisit;
  if (!visit || visit.day !== gameState.day) {
    closeModal();
    return;
  }

  renderModal(`
    <h2>Traveling Merchant</h2>
    <p class="modal-sub">Here for the day only — gone again tomorrow, whatever's left unsold.</p>
    <div class="pack-list">${visit.offers.map(merchantOfferRowHtml).join('')}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-merchant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!gameState.buyMerchantOffer(btn.dataset.id!)) {
        playError();
        return;
      }
      playChime();
      openMerchantModal();
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Fountain fishing (an energy-for-gold side activity independent of
// both the Wilds and the shop, with its own short Fish Codex to complete) ---

function fishCodexRowHtml(fish: FishDef): string {
  const count = gameState.fishCaught[fish.id] ?? 0;
  if (count === 0) {
    return `
      <div class="codex-row codex-row-undiscovered">
        <div class="codex-thumb-wrap codex-thumb-undiscovered">?</div>
        <div class="codex-info">
          <div class="codex-name">???</div>
          <div class="codex-meta">${RARITY_LABELS[fish.rarity]} &middot; not yet caught</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="codex-row">
      <div class="codex-thumb-wrap"><div class="fish-icon">&#128031;</div></div>
      <div class="codex-info">
        <div class="codex-name">${fish.name}</div>
        <div class="codex-meta">${RARITY_LABELS[fish.rarity]} &middot; caught &times;${count}</div>
      </div>
    </div>
  `;
}

function openFountainModal(result?: { fish: FishDef; goldEarned: number }) {
  if (!gameState.townUpgrades.fountainRepaired) {
    closeModal();
    return;
  }
  const castCost = gameState.fishingCastCost;
  const canCast = gameState.energy >= castCost;
  const resultHtml = result
    ? `<div class="gift-feedback${result.fish.rarity === 'legendary' || result.fish.rarity === 'epic' ? ' gift-feedback-match' : ''}">
        Caught a <strong>${result.fish.name}</strong>! &middot; +${result.goldEarned}g
        <div class="fish-flavor">"${result.fish.flavor}"</div>
      </div>`
    : '';
  const caughtCount = Object.keys(gameState.fishCaught).length;

  renderModal(`
    <h2>The Fountain</h2>
    <p class="modal-sub">Toss a line in and see what bites — ${castCost} energy a cast, for a small, reliable bit of gold. No risk, no cards, just something else to do with the day.</p>
    ${resultHtml}
    <div class="modal-actions">
      <button class="btn cast-line-btn" ${canCast ? '' : 'disabled'}>${canCast ? 'Cast Line' : 'Too tired to fish'}</button>
    </div>
    <h2 class="modal-section-title">Fish Codex &middot; ${caughtCount}/${FISH_SPECIES.length}</h2>
    <div class="codex-list">${FISH_SPECIES.map(fishCodexRowHtml).join('')}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  const castBtn = modalLayer.querySelector('.cast-line-btn') as HTMLButtonElement | null;
  castBtn?.addEventListener('click', () => {
    castBtn.disabled = true;
    castBtn.textContent = 'Waiting for a bite...';
    setTimeout(() => {
      // The modal may have been closed (or replaced) during the wait —
      // bail out rather than yanking the player back into it.
      if (!castBtn.isConnected) return;
      const catchResult = gameState.castFishingLine();
      if (!catchResult) {
        playError();
        openFountainModal();
        return;
      }
      if (catchResult.fish.rarity === 'legendary') playLegendary();
      else playCoin();
      openFountainModal(catchResult);
    }, 550);
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Customize (outfits + shop decor — pure cosmetics, no gameplay effect) ---

function outfitRowHtml(outfit: OutfitDef): string {
  const owned = gameState.ownedOutfits.includes(outfit.id);
  const equipped = gameState.equippedOutfitId === outfit.id;
  let actionHtml: string;
  if (equipped) {
    actionHtml = `<button class="btn btn-small" disabled>Equipped</button>`;
  } else if (owned) {
    actionHtml = `<button class="btn btn-small equip-outfit-btn" data-id="${outfit.id}">Equip</button>`;
  } else {
    actionHtml = `<button class="btn btn-small buy-outfit-btn" data-id="${outfit.id}" ${gameState.gold < outfit.cost ? 'disabled' : ''}>${outfit.cost}g</button>`;
  }
  return `
    <div class="pack-row${equipped ? ' outfit-row-equipped' : ''}">
      <div class="pack-swatch outfit-swatch" style="background:${colorToCss(outfit.color)}"></div>
      <div class="pack-info">
        <div class="pack-name">${outfit.name}</div>
        <div class="pack-meta">${outfit.description}</div>
      </div>
      ${actionHtml}
    </div>
  `;
}

function decorRowHtml(item: DecorDef): string {
  const owned = gameState.ownedDecor.includes(item.id);
  const actionHtml = owned
    ? `<span class="board-claimed-tag">&#10003; Placed</span>`
    : `<button class="btn btn-small buy-decor-btn" data-id="${item.id}" ${gameState.gold < item.cost ? 'disabled' : ''}>${item.cost}g</button>`;
  return `
    <div class="pack-row">
      <div class="pack-swatch" style="background:${colorToCss(item.color)}"></div>
      <div class="pack-info">
        <div class="pack-name">${item.name}</div>
        <div class="pack-meta">${item.description}</div>
      </div>
      ${actionHtml}
    </div>
  `;
}

function customizeTabHtml(): string {
  return `
    <p class="modal-sub">Spend gold on how you look and how your shop feels — pure style, no gameplay effect.</p>
    <h2 class="modal-section-title">Outfits</h2>
    <div class="pack-list">${OUTFITS.map(outfitRowHtml).join('')}</div>
    <h2 class="modal-section-title">Shop Decorations</h2>
    <div class="pack-list">${DECOR_ITEMS.map(decorRowHtml).join('')}</div>
  `;
}

function wireCustomizeTab() {
  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-outfit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const outfit = OUTFITS.find((o) => o.id === btn.dataset.id)!;
      if (!gameState.purchaseOutfit(outfit.id, outfit.cost)) return;
      gameState.equipOutfit(outfit.id);
      playCoin();
      openMenuModal('customize');
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.equip-outfit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      gameState.equipOutfit(btn.dataset.id!);
      playChime();
      openMenuModal('customize');
    });
  });
  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-decor-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = DECOR_ITEMS.find((d) => d.id === btn.dataset.id)!;
      if (!gameState.purchaseDecor(item.id, item.cost)) return;
      playCoin();
      openMenuModal('customize');
    });
  });
}

// --- NPC dialogue ---

interface GiftFeedback {
  matchedRequest: boolean;
  friendshipGain: number;
  goldGain: number;
}

function openNpcModal(npcId: string, feedback?: GiftFeedback) {
  const def = NPCS.find((n) => n.id === npcId)!;
  const npcState = gameState.npcs[npcId];
  const tier = friendshipTier(npcState.friendship);
  const line = def.lines[tier][Math.floor(Math.random() * def.lines[tier].length)];
  const alreadyTalkedToday = npcState.lastTalkedDay === gameState.day;
  const request = npcState.request;

  const requestHtml = request
    ? `<div class="npc-request">Wants a <strong>${RARITY_LABELS[request.rarity]}</strong> card from <strong>${SEASON_SET_NAME[request.season]}</strong> — gift one for a bonus!</div>`
    : '';

  const feedbackHtml = feedback
    ? `<div class="gift-feedback${feedback.matchedRequest ? ' gift-feedback-match' : ''}">
        ${feedback.matchedRequest ? '&#9733; Request fulfilled! ' : 'Thanks! '}
        +${feedback.friendshipGain} friendship${feedback.goldGain > 0 ? ` &middot; +${feedback.goldGain}g` : ''}
      </div>`
    : '';

  const giftRows =
    gameState.inventory.length === 0
      ? `<p class="modal-sub">You have no cards in your bag to gift.</p>`
      : `<div class="codex-list">${gameState.inventory
          .map((c, idx) => {
            const matches = !!request && c.season === request.season && c.rarity === request.rarity;
            return compactCardRowHtml(c, idx, `<button class="btn btn-small gift-btn" data-idx="${idx}">Gift</button>`, matches);
          })
          .join('')}</div>`;

  renderModal(`
    <h2>${def.name}</h2>
    <div class="npc-tier">${FRIENDSHIP_TIER_LABELS[tier]}</div>
    <div class="friend-bar"><div class="friend-bar-fill" style="width:${npcState.friendship}%"></div></div>
    <p class="npc-line">"${line}"</p>
    ${requestHtml}
    ${feedbackHtml}
    <div class="modal-actions">
      <button class="btn talk-btn" ${alreadyTalkedToday ? 'disabled' : ''}>${alreadyTalkedToday ? 'Already talked today' : 'Talk'}</button>
    </div>
    <h2 class="modal-section-title">Give a Gift</h2>
    ${giftRows}
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
      const result = gameState.giftCardToNpc(npcId, card.id);
      if (result.matchedRequest) playLegendary();
      else playChime();
      openNpcModal(npcId, result);
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Bag (opened on demand only — it used to sit permanently docked
// across the bottom of the screen, covering the play area) ---

function bagTabHtml(): string {
  const body =
    gameState.inventory.length === 0
      ? `<p class="modal-sub">Your bag is empty. Buy or find a pack to fill it up.</p>`
      : `<div class="reveal-grid">${gameState.inventory.map((c) => cardSlotHtml(c)).join('')}</div>`;

  return `
    <p class="modal-sub">${gameState.inventory.length} card${gameState.inventory.length === 1 ? '' : 's'} on hand. Place them on a shelf, gift one to a townsfolk, or just browse.</p>
    ${body}
  `;
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
  const stageNote = card.stageCount > 1 ? ` &middot; Stage ${card.stage}/${card.stageCount}` : '';
  const discovered = gameState.discoveredCards.has(`${card.speciesId}:${card.stage}`);

  if (!discovered) {
    return `
      <div class="codex-row codex-row-undiscovered">
        <div class="codex-thumb-wrap codex-thumb-undiscovered">?</div>
        <div class="codex-info">
          <div class="codex-name">???</div>
          <div class="codex-meta">${RARITY_LABELS[card.rarity]}${stageNote} &middot; not yet found</div>
        </div>
        <div class="codex-price">???</div>
      </div>
    `;
  }

  const art = cardArtHtml(card.speciesId, card.stage, encyclopediaSeason, card.rarity, 'codex-thumb', 'codex-thumb-fallback');
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
    // A search never matches an undiscovered card's hidden real name — that
    // would leak it. With a query active, only discovered matches show.
    const cards = pool[rarity].filter((c) => {
      if (!query) return true;
      return gameState.discoveredCards.has(`${c.speciesId}:${c.stage}`) && c.name.toLowerCase().includes(query);
    });
    if (cards.length === 0) return '';
    return `
      <h3 class="codex-rarity-heading rarity-pill-${rarity}">${RARITY_LABELS[rarity]} <span class="codex-count">${cards.length}</span></h3>
      ${cards.map(codexRowHtml).join('')}
    `;
  }).join('');
  return sections.trim() ? sections : `<p class="modal-sub">No cards match "${encyclopediaQuery}".</p>`;
}

function seasonDiscoveryCount(season: Season): { discovered: number; total: number } {
  const pool = SEASON_CARD_POOL[season];
  let discovered = 0;
  let total = 0;
  for (const rarity of RARITIES) {
    for (const c of pool[rarity]) {
      total += 1;
      if (gameState.discoveredCards.has(`${c.speciesId}:${c.stage}`)) discovered += 1;
    }
  }
  return { discovered, total };
}

function cardsTabHtml(): string {
  const tabs = SEASONS.map(
    (season) =>
      `<button class="btn btn-small codex-tab-btn${season === encyclopediaSeason ? ' codex-tab-active' : ''}" data-season="${season}">${season}</button>`,
  ).join('');
  const { discovered, total } = seasonDiscoveryCount(encyclopediaSeason);
  const seasonComplete = total > 0 && discovered >= total;
  const setBonusHtml = seasonComplete
    ? `<span class="set-complete-badge">&#10022; Set Complete — +5% sale price on everything, forever</span>`
    : '';
  const overallBonusPct = Math.round((gameState.saleGoldMultiplier - 1) * 100);

  return `
    <p class="modal-sub">Discovered <strong>${discovered}/${total}</strong> in ${SEASON_SET_NAME[encyclopediaSeason]}. Undiscovered cards show as "???" until you pull one — prices are rough estimates once found.
    ${overallBonusPct > 0 ? `<br>Current sale-price bonus from completed sets and perks: <strong>+${overallBonusPct}%</strong>.` : ''}
    </p>
    ${setBonusHtml}
    <div class="codex-tabs">${tabs}</div>
    <input type="text" id="codex-search" class="codex-search" placeholder="Search by name..." value="${encyclopediaQuery}" />
    <div class="codex-list" id="codex-list">${encyclopediaBodyHtml()}</div>
  `;
}

function wireCardsTab() {
  modalLayer.querySelectorAll<HTMLButtonElement>('.codex-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      encyclopediaSeason = btn.dataset.season as Season;
      openMenuModal('cards');
    });
  });
  const searchInput = modalLayer.querySelector('#codex-search') as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    encyclopediaQuery = searchInput.value;
    const list = modalLayer.querySelector('#codex-list')!;
    list.innerHTML = encyclopediaBodyHtml();
  });
  searchInput.focus();
}

// --- Legacy (the long-run goal beyond "more gold") ---

function legacyRowHtml(m: LegacyMilestone, capstone = false): string {
  const done = m.check();
  const prog = m.progress?.();
  const progressHtml =
    prog && !done
      ? `<div class="legacy-bar"><div class="legacy-bar-fill" style="width:${Math.min(100, (prog.current / prog.target) * 100)}%"></div></div>
         <div class="legacy-progress-label">${prog.current.toLocaleString()} / ${prog.target.toLocaleString()}</div>`
      : '';
  return `
    <div class="legacy-row${done ? ' legacy-row-done' : ''}${capstone ? ' legacy-row-capstone' : ''}">
      <div class="legacy-check">${done ? '&#10003;' : capstone ? '&#9733;' : ''}</div>
      <div class="legacy-info">
        <div class="legacy-name">${m.name}</div>
        <div class="legacy-desc">${m.description}</div>
        ${progressHtml}
      </div>
    </div>
  `;
}

function prestigePerksOwnedHtml(): string {
  if (gameState.prestigePerks.length === 0) return '';
  const counts = new Map<string, number>();
  for (const id of gameState.prestigePerks) counts.set(id, (counts.get(id) ?? 0) + 1);
  const rows = [...counts.entries()]
    .map(([id, count]) => {
      const def = PRESTIGE_PERKS.find((p) => p.id === id);
      if (!def) return '';
      return `<li>${def.name}${count > 1 ? ` &times;${count}` : ''} — ${def.description}</li>`;
    })
    .join('');
  return `<ul class="prestige-perk-list">${rows}</ul>`;
}

function openPrestigeChoiceModal() {
  const rows = PRESTIGE_PERKS.map(
    (perk) => `
    <div class="pack-row">
      <div class="pack-info">
        <div class="pack-name">${perk.name}</div>
        <div class="pack-meta">${perk.description}</div>
      </div>
      <button class="btn btn-small choose-perk-btn" data-id="${perk.id}">Choose</button>
    </div>
  `,
  ).join('');

  renderModal(`
    <h2>Begin Anew</h2>
    <p class="modal-sub">
      Pick a permanent perk. Your gold, shelves, upgrades, packs, and townsfolk friendships reset —
      but the Encyclopedia, your lifetime stats, and every perk you've ever picked stay with you.
    </p>
    <div class="pack-list">${rows}</div>
    <button class="btn btn-secondary close-btn">Cancel</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.choose-perk-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!gameState.prestige(btn.dataset.id!)) return;
      playLegendary();
      openMenuModal('legacy');
    });
  });
  modalLayer.querySelector('.close-btn')!.addEventListener('click', () => openMenuModal('legacy'));
}

function legacyTabHtml(): string {
  const doneCount = LEGACY_MILESTONES.filter((m) => m.check()).length;
  const capstoneDone = LEGACY_CAPSTONE.check();
  const prestigeSection = capstoneDone
    ? `
      <h2 class="modal-section-title">Prestige${gameState.prestigeLevel > 0 ? ` — Level ${gameState.prestigeLevel}` : ''}</h2>
      <p class="modal-sub">You've done everything the valley has to offer this run. Begin anew for a permanent, stacking perk.</p>
      ${prestigePerksOwnedHtml()}
      <button class="btn prestige-btn">Begin Anew</button>
    `
    : '';
  return `
    <p class="modal-sub">
      ${capstoneDone ? "You've become a legend of this valley." : `${doneCount}/${LEGACY_MILESTONES.length} milestones complete. Gold is just the fuel — this is what it's for.`}
    </p>
    <div class="legacy-list">${LEGACY_MILESTONES.map((m) => legacyRowHtml(m)).join('')}</div>
    <h2 class="modal-section-title">Capstone</h2>
    <div class="legacy-list">${legacyRowHtml(LEGACY_CAPSTONE, true)}</div>
    ${prestigeSection}
  `;
}

function wireLegacyTab() {
  modalLayer.querySelector('.prestige-btn')?.addEventListener('click', openPrestigeChoiceModal);
}

// --- Day (part of the Menu — ends the day in place of the old standalone button) ---

function dayTabHtml(): string {
  const pendingLine =
    gameState.pendingPacks.length > 0
      ? ` ${gameState.pendingPacks.length} pending pack${gameState.pendingPacks.length === 1 ? '' : 's'} will arrive.`
      : '';
  return `
    <p class="modal-sub">
      Day ${gameState.day} &middot; ${SEASON_SET_NAME[gameState.season]}
      &middot; ${gameState.daysLeftInSeason} day${gameState.daysLeftInSeason === 1 ? '' : 's'} left before this set rotates out.
    </p>
    <p class="modal-sub">Energy: ${Math.round(gameState.energy)}/${gameState.maxEnergy}. Ending the day fully restores it.${pendingLine}</p>
    <button class="btn end-day-btn">End Day</button>
  `;
}

function wireDayTab() {
  modalLayer.querySelector('.end-day-btn')!.addEventListener('click', () => {
    gameState.endDay();
  });
}

// --- Perk tree (permanent, gold-bought passive bonuses — survives Prestige) ---

const PERK_BRANCH_ORDER: PerkBranch[] = ['combat', 'commerce', 'wilds', 'fishing'];

function perksTabHtml(): string {
  const sections = PERK_BRANCH_ORDER.map((branch) => {
    const rows = PERKS.filter((p) => p.branch === branch)
      .map((def) => {
        const owned = gameState.hasPerk(def.id);
        const locked = !!def.requiresId && !gameState.hasPerk(def.requiresId);
        return upgradeRowHtml(def.id, def.name, def.cost, def.description, owned, locked);
      })
      .join('');
    return `<h2 class="modal-section-title">${PERK_BRANCH_LABELS[branch]}</h2><div class="pack-list">${rows}</div>`;
  }).join('');
  return `<p class="modal-sub">Permanent passive bonuses, bought with gold — unlike Prestige, these never reset.</p>${sections}`;
}

function wirePerksTab() {
  modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!gameState.purchasePerk(btn.dataset.key!)) {
        playError();
        return;
      }
      playChime();
      openMenuModal('perks');
    });
  });
}

// --- Menu (tabbed: Bag / Cards / Legacy / Customize / Day) ---

type MenuTab = 'bag' | 'cards' | 'legacy' | 'perks' | 'customize' | 'day';

const MENU_TABS: { id: MenuTab; label: string }[] = [
  { id: 'bag', label: '&#127890; Bag' },
  { id: 'cards', label: '&#128214; Cards' },
  { id: 'legacy', label: '&#127942; Legacy' },
  { id: 'perks', label: '&#127775; Perks' },
  { id: 'customize', label: '&#127912; Customize' },
  { id: 'day', label: '&#9203; Day' },
];

let activeMenuTab: MenuTab = 'bag';

function openMenuModal(tab: MenuTab = activeMenuTab) {
  activeMenuTab = tab;
  const tabBar = MENU_TABS.map(
    (t) => `<button class="btn btn-small menu-tab-btn${t.id === tab ? ' menu-tab-active' : ''}" data-tab="${t.id}">${t.label}</button>`,
  ).join('');
  const content =
    tab === 'bag'
      ? bagTabHtml()
      : tab === 'cards'
        ? cardsTabHtml()
        : tab === 'legacy'
          ? legacyTabHtml()
          : tab === 'perks'
            ? perksTabHtml()
            : tab === 'customize'
              ? customizeTabHtml()
              : dayTabHtml();

  renderModal(`
    <h2>Menu</h2>
    <div class="menu-tabs">${tabBar}</div>
    <div id="menu-content">${content}</div>
    <button class="btn btn-secondary close-btn">Close</button>
  `);

  modalLayer.querySelectorAll<HTMLButtonElement>('.menu-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextTab = btn.dataset.tab as MenuTab;
      // Always land on the current season rather than wherever the
      // Encyclopedia was last left browsing.
      if (nextTab === 'cards') encyclopediaSeason = gameState.season;
      openMenuModal(nextTab);
    });
  });
  if (tab === 'cards') wireCardsTab();
  else if (tab === 'legacy') wireLegacyTab();
  else if (tab === 'perks') wirePerksTab();
  else if (tab === 'customize') wireCustomizeTab();
  else if (tab === 'day') wireDayTab();

  modalLayer.querySelector('.close-btn')!.addEventListener('click', closeModal);
}

// --- Intro (shown once, on a brand-new game) ---

/** A tongue-in-cheek reason to be here at all — shown once, before the
 * player's first move, on a save-free start. Nothing here is meant to be
 * taken seriously; it's just enough of a hook to get the ball rolling. */
export function showIntroModal() {
  renderModal(`
    <h2>How You Ended Up Here</h2>
    <p class="modal-sub">
      The letter arrived on a Tuesday, wedged between a parking ticket and a coupon for a
      "Buy One Get One Free" hearing aid — no return address, suspiciously nice stationery:
      <em>"You have inherited One (1) Card Shop in the town of Hearthollow. Please arrive by
      sundown. Do not ask about the previous owner."</em>
    </p>
    <p class="modal-sub">
      You didn't have anything better going on, so here you are: keys in hand, standing behind
      a dusty counter in a town where the fountain doesn't run, the Town Hall clerk looks
      personally offended by joy, and — for reasons absolutely nobody will explain — the woods
      out back are full of monsters that occasionally drop trading cards. Seems fine. Probably fine.
    </p>
    <p class="modal-sub">
      Anyway. You sell cards now. Let's make some gold.
    </p>
    <button class="btn intro-start-btn">Let's Get Started</button>
  `);
  modalLayer.querySelector('.intro-start-btn')!.addEventListener('click', closeModal);
}

// --- HUD ---

function renderBagCount() {
  // The bag count no longer lives on the HUD itself — only refresh the
  // Bag tab's own content, and only when it's the one actually on screen.
  if (activeMenuTab === 'bag' && modalLayer.querySelector('.menu-tabs')) {
    openMenuModal('bag');
  }
}

function renderSeasonBadge() {
  const el = document.getElementById('season-value');
  if (el) el.textContent = gameState.season;
  const festival = document.getElementById('festival-banner');
  if (festival) festival.hidden = !gameState.isFestivalDay;
  const merchant = document.getElementById('merchant-banner');
  if (merchant) merchant.hidden = gameState.merchantVisit?.day !== gameState.day;
}

export function initUI() {
  const root = document.getElementById('ui-root') as HTMLDivElement;
  root.innerHTML = `
    <div id="hud">
      <div class="hud-stat">Gold: <span id="gold-value">${gameState.gold}</span>g</div>
      <div class="hud-stat">❤ <span id="hp-value">${gameState.hp}</span>/<span id="max-hp-value">${gameState.maxHp}</span></div>
      <div class="hud-stat">Day <span id="day-value">${gameState.day}</span> &middot; <span id="season-value">${gameState.season}</span></div>
      <div id="festival-banner" class="festival-banner" ${gameState.isFestivalDay ? '' : 'hidden'}>🎉 Festival</div>
      <div id="merchant-banner" class="festival-banner merchant-banner" ${gameState.merchantVisit?.day === gameState.day ? '' : 'hidden'}>🛒 Merchant in town</div>
      <div class="hud-energybar" title="Energy — fades slowly on its own, faster in the Wilds. Sleep (End Day) to restore it.">
        <span class="energy-icon">&#9889;</span>
        <div class="energy-track"><div id="energy-fill" class="energy-fill${gameState.energy / gameState.maxEnergy < 0.25 ? ' energy-low' : ''}" style="width:${(gameState.energy / gameState.maxEnergy) * 100}%"></div></div>
      </div>
      <div id="exhausted-badge" class="exhausted-badge" title="Out of energy — slow, selling for less, and worse at everything until you sleep." ${gameState.isExhausted ? '' : 'hidden'}>EXHAUSTED</div>
      <button id="menu-btn" class="btn btn-small">&#9776; Menu</button>
    </div>
    <div id="auto-sale-toast" class="auto-sale-toast" hidden></div>
    <div id="modal-layer"></div>
  `;
  modalLayer = root.querySelector('#modal-layer') as HTMLDivElement;

  document.getElementById('menu-btn')!.addEventListener('click', () => openMenuModal());

  // Escape always does the obvious thing: close whatever's open, or if
  // nothing is, open the Menu — a keyboard-only path to the same place the
  // corner X and the HUD button reach. E does the same when a scene's own
  // E-interact found nothing nearby to interact with (see bus 'open-menu').
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (modalLayer.innerHTML) activeCloseHandler();
    else openMenuModal();
  });
  bus.on('open-menu', () => {
    if (!modalLayer.innerHTML) openMenuModal();
  });

  renderSeasonBadge();

  let lastGold = gameState.gold;
  bus.on('gold-changed', (gold: number) => {
    const goldEl = document.getElementById('gold-value')!;
    goldEl.textContent = String(gold);
    if (gold > lastGold) {
      // A little "reward" pop instead of the number just silently updating.
      goldEl.classList.remove('stat-pop');
      void goldEl.offsetWidth; // restart the animation if it's already mid-pop
      goldEl.classList.add('stat-pop');
    }
    lastGold = gold;
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-pack-btn').forEach((btn) => {
      const pack = PACKS.find((p) => p.id === btn.dataset.pack);
      if (pack) btn.disabled = gold < effectivePackCost(pack);
    });
    const tonicBtn = modalLayer.querySelector<HTMLButtonElement>('.buy-tonic-btn');
    if (tonicBtn) tonicBtn.disabled = gold < ENERGY_TONIC_COST || gameState.energy >= gameState.maxEnergy;
    const firstAidBtn = modalLayer.querySelector<HTMLButtonElement>('.buy-firstaid-btn');
    if (firstAidBtn) firstAidBtn.disabled = gold < FIRST_AID_KIT_COST || gameState.hp >= gameState.maxHp;
    const rangedBtn = modalLayer.querySelector<HTMLButtonElement>('.buy-ranged-btn');
    if (rangedBtn) rangedBtn.disabled = gold < RANGED_WEAPON_COST;
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-upgrade-btn').forEach((btn) => {
      const def =
        TOWN_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key) ??
        COMBAT_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key) ??
        MOVEMENT_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key) ??
        RANGED_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      if (def) btn.disabled = gold < def.cost;
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.order-upgrade-btn').forEach((btn) => {
      const def = SHOP_UPGRADE_DEFS.find((d) => d.key === btn.dataset.key);
      if (def) btn.disabled = gold < def.cost;
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.unlock-zone-btn').forEach((btn) => {
      const zone = ZONE_DEFS.find((z) => z.id === btn.dataset.zone);
      if (zone) btn.disabled = gold < zone.unlockCost;
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-outfit-btn').forEach((btn) => {
      const outfit = OUTFITS.find((o) => o.id === btn.dataset.id);
      if (outfit) btn.disabled = gold < outfit.cost;
    });
    modalLayer.querySelectorAll<HTMLButtonElement>('.buy-decor-btn').forEach((btn) => {
      const item = DECOR_ITEMS.find((d) => d.id === btn.dataset.id);
      if (item) btn.disabled = gold < item.cost;
    });
  });
  bus.on('day-changed', (day: number) => {
    document.getElementById('day-value')!.textContent = String(day);
    renderSeasonBadge();
  });
  bus.on('energy-changed', (energy: number) => {
    const pct = Math.max(0, Math.min(100, (energy / gameState.maxEnergy) * 100));
    const fill = document.getElementById('energy-fill');
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.classList.toggle('energy-low', pct < 25);
    }
    const badge = document.getElementById('exhausted-badge');
    if (badge) (badge as HTMLElement).hidden = !gameState.isExhausted;
  });
  bus.on('inventory-changed', renderBagCount);
  bus.on('shop-upgrades-changed', renderBagCount);
  bus.on('hp-changed', (hp: number) => {
    const el = document.getElementById('hp-value');
    if (el) el.textContent = String(Math.round(hp));
  });
  bus.on('combat-upgrades-changed', () => {
    const el = document.getElementById('max-hp-value');
    if (el) el.textContent = String(gameState.maxHp);
  });
  let autoSaleToastTimer: ReturnType<typeof setTimeout> | null = null;
  bus.on('auto-sale', ({ cardName, earned }: { cardName: string; earned: number }) => {
    const toast = document.getElementById('auto-sale-toast');
    if (!toast) return;
    toast.textContent = `Clerk sold ${cardName} for ${earned}g!`;
    toast.hidden = false;
    playCoin();
    if (autoSaleToastTimer) clearTimeout(autoSaleToastTimer);
    autoSaleToastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2600);
  });
  bus.on('open-counter', openCounterModal);
  bus.on('open-distributor', openDistributorModal);
  bus.on('open-general-store', openGeneralStoreModal);
  bus.on('open-haggle', (ticketId: number) => openHaggleModal(ticketId));
  bus.on('open-shelf', (shelfId: string) => openShelfModal(shelfId));
  bus.on('day-summary', (summary: DaySummary) => openDaySummaryModal(summary));
  bus.on('open-townhall', openTownHallModal);
  bus.on('open-zonemap', openZoneMapModal);
  bus.on('open-merchant', openMerchantModal);
  bus.on('open-fountain', () => openFountainModal());
  bus.on('open-npc', (npcId: string) => openNpcModal(npcId));
}
