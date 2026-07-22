import Decimal from 'decimal.js';
import { AUTO_TAP_INTERVAL_SECONDS } from '../data/upgrades.js';
import { ACHIEVEMENTS, getAchievementIdleMultiplier } from '../data/achievements.js';
import { normalizeBuyAmount } from '../config/buyAmounts.js';
import { calculateAscensionTokenGain, getAscensionTokenIdleMultiplier } from './prestige.js';
import {
  BOOST_ID_ALIASES,
  UPGRADE_ID_ALIASES,
  normalizeSaveState,
} from '../services/saveMigrations.js';
import { getAutoTapCursorTier, getMaxAutoTapCursorSlots } from './autoTapProgress.js';

/**
 * @typedef {object} UpgradeCatalogEntry
 * @property {string} id
 * @property {string} label
 * @property {number|string} baseCost
 * @property {number|string} baseValue
 * @property {number} [growth]
 * @property {'click'|'auto'|'auto_tap'} type
 * @property {string} [unlockAfter]
 * @property {number} [level]
 */

/**
 * @typedef {object} MetaUpgradeCatalogEntry
 * @property {string} id
 * @property {string} name
 * @property {'generator'|'global'|'click_per_second'|'base_multiplier'} kind
 * @property {boolean} [purchased]
 */

/**
 * @typedef {object} SaveSnapshot
 * @property {string|number} coins
 * @property {string|number} [totalCoinsEarned]
 * @property {number} totalClicks
 * @property {number} [autoTapProgress]
 * @property {{ id: string, level: number }[]} [upgrades]
 * @property {{ id: string, purchased: boolean }[]} [boosts]
 * @property {number|string} [savedAt]
 */

// Cookie Clicker formatEveryThirdPower notations ('' is index 0 after the initial /1000).
const SCALE_FROM_MILLION = [
  '',
  ' million',
  ' billion',
  ' trillion',
  ' quadrillion',
  ' quintillion',
  ' sextillion',
  ' septillion',
  ' octillion',
  ' nonillion',
  ' decillion',
];

function toDecimal(value) {
  if (value instanceof Decimal) {
    return value;
  }

  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }

  try {
    return new Decimal(value);
  } catch (error) {
    return new Decimal(0);
  }
}

function formatWithCommas(integerString) {
  return integerString.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Keep the last shown digit from updating more than ~2x/sec (avoids flicker).
function decimalsForRate(unitsPerSecond, maxDecimals) {
  const rate = Number(unitsPerSecond);

  if (!Number.isFinite(rate) || rate <= 0) {
    return maxDecimals;
  }

  return Math.max(0, Math.min(maxDecimals, Math.floor(Math.log10(2 / rate))));
}

function formatScaleCoefficient(value, decimals) {
  if (decimals <= 0) {
    return value.round().toFixed(0);
  }

  return value.toFixed(decimals).replace(/\.?0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

// Cookie Clicker-style Beautify: commas below 1M, "X.XXX billion" from 1M up.
// Pass { rate } (e.g. perSecond) to drop decimals when the scale already ticks fast.
export function formatCoins(value, options = {}) {
  const floats = typeof options === 'number' ? options : (options.floats ?? 1);
  const rate = typeof options === 'number' ? undefined : options.rate;
  const amount = toDecimal(value);
  const rateAmount = rate === undefined || rate === null ? null : toDecimal(rate);

  if (!amount.isFinite() || amount.isNaN()) {
    return '0';
  }

  const sign = amount.isNeg() ? '-' : '';
  const abs = amount.abs();

  if (abs.gte(1_000_000)) {
    let scaled = abs.div(1000);
    let base = 0;

    while (scaled.round().gte(1000)) {
      if (base >= SCALE_FROM_MILLION.length - 1) {
        return `${sign}${abs.toExponential(2).replace('e+', 'e')}`;
      }

      scaled = scaled.div(1000);
      base += 1;
    }

    const scaleDivisor = Decimal.pow(1000, base + 1);
    const scaledRate = rateAmount && rateAmount.isFinite() ? rateAmount.abs().div(scaleDivisor) : null;
    const decimals = scaledRate ? decimalsForRate(scaledRate, 3) : 3;

    return `${sign}${formatScaleCoefficient(scaled, decimals)}${SCALE_FROM_MILLION[base]}`;
  }

  const decimals = rateAmount && rateAmount.isFinite() ? decimalsForRate(rateAmount.abs(), floats) : floats;

  if (decimals > 0 && !abs.trunc().eq(abs)) {
    const [integerPart, decimalPart] = abs.toFixed(decimals).split('.');
    return `${sign}${formatWithCommas(integerPart)}.${decimalPart}`;
  }

  return `${sign}${formatWithCommas(abs.trunc().toFixed(0))}`;
}

function calculateUpgradeCost(upgrade) {
  const baseCost = toDecimal(upgrade.baseCost);
  const growth = toDecimal(upgrade.growth);
  return baseCost.times(growth.pow(upgrade.level)).floor();
}

/** Total cost to buy `amount` levels starting from current level (geometric series). */
export function calculateBulkUpgradeCost(upgrade, amount) {
  const levels = Math.max(0, Math.floor(Number(amount) || 0));
  if (levels <= 0) {
    return new Decimal(0);
  }

  const growth = toDecimal(upgrade.growth);
  const first = toDecimal(upgrade.baseCost).times(growth.pow(upgrade.level));

  if (growth.eq(1)) {
    return first.times(levels).floor();
  }

  return first.times(growth.pow(levels).minus(1)).div(growth.minus(1)).floor();
}

/** How many levels can be bought with current coins for this upgrade. */
export function getMaxAffordableUpgradeAmount(state, upgrade) {
  if (!upgrade || !isUpgradeUnlocked(upgrade, state.upgrades)) {
    return 0;
  }

  const coins = toDecimal(state.coins);
  if (coins.lte(0)) {
    return 0;
  }

  let low = 0;
  let high = 1;
  while (high < 1e9 && calculateBulkUpgradeCost(upgrade, high).lte(coins)) {
    low = high;
    high *= 2;
  }

  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (calculateBulkUpgradeCost(upgrade, mid).lte(coins)) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

export function resolveBuyAmount(state, upgrade, buyAmount) {
  const normalized = normalizeBuyAmount(buyAmount);
  if (normalized === 'max') {
    return getMaxAffordableUpgradeAmount(state, upgrade);
  }
  return normalized;
}

function cloneUpgrades(upgrades) {
  return upgrades.map((upgrade) => ({ ...upgrade, level: 0 }));
}

function cloneBoosts(boosts) {
  return boosts.map((boost) => ({ ...boost, purchased: false }));
}

function getUpgradeLevel(state, upgradeId) {
  return state.upgrades.find((item) => item.id === upgradeId)?.level ?? 0;
}

function getTotalGeneratorOwned(state) {
  return state.upgrades.filter((upgrade) => upgrade.type === 'auto').reduce((sum, upgrade) => sum + upgrade.level, 0);
}

export function isMetaUpgradeUnlocked(state, boost) {
  if (!boost || boost.purchased) {
    return false;
  }

  if (boost.kind === 'generator') {
    return getUpgradeLevel(state, boost.targetId) >= boost.requiredOwned;
  }

  if (boost.kind === 'global') {
    return getTotalGeneratorOwned(state) >= boost.requiredTotalOwned;
  }

  if (boost.kind === 'base_multiplier') {
    return toDecimal(state.totalCoinsEarned).gte(boost.requiredTotalCoins);
  }

  if (boost.kind === 'click_per_second') {
    return state.totalClicks >= boost.requiredClicks;
  }

  return false;
}

function getPurchasedBoosts(boosts) {
  return boosts.filter((boost) => boost.purchased);
}

/** Yellow store efficiency pips: one per purchased generator efficiency meta-upgrade. */
export function getGeneratorEfficiencyStarCount(state, generatorId) {
  if (!state?.boosts || !generatorId) {
    return 0;
  }

  return getPurchasedBoosts(state.boosts).filter(
    (boost) => boost.kind === 'generator' && boost.targetId === generatorId,
  ).length;
}

function getGeneratorProductionMultiplier(state, generatorId) {
  let multiplier = new Decimal(1);

  getPurchasedBoosts(state.boosts).forEach((boost) => {
    if (boost.kind === 'generator' && boost.targetId === generatorId) {
      multiplier = multiplier.times(toDecimal(boost.multiplier));
    }
  });

  return multiplier;
}

function getGeneratorAutoRate(state, upgrade) {
  return toDecimal(upgrade.baseValue).times(upgrade.level).times(getGeneratorProductionMultiplier(state, upgrade.id));
}

/**
 * Share of total idle (auto) production from one generator, 0..1.
 * Returns null when there is no idle yet or this generator contributes nothing (hide % in UI).
 */
export function getGeneratorIdleShare(state, generatorId) {
  if (!state?.upgrades || !generatorId) {
    return null;
  }

  const generators = state.upgrades.filter((upgrade) => upgrade.type === 'auto');
  let total = new Decimal(0);
  let own = new Decimal(0);

  generators.forEach((upgrade) => {
    const rate = getGeneratorAutoRate(state, upgrade);
    total = total.plus(rate);
    if (upgrade.id === generatorId) {
      own = rate;
    }
  });

  if (total.lte(0) || own.lte(0)) {
    return null;
  }

  return own.div(total).toNumber();
}

/** Compact percent label for STORE rows (`12%`, `1.2%`, `0.08%`). */
export function formatIdleSharePercent(share) {
  if (share == null || !(share > 0)) {
    return null;
  }

  const pct = share * 100;
  if (pct >= 9.95) {
    return `${Math.round(pct)}%`;
  }
  if (pct >= 0.995) {
    return `${pct.toFixed(1)}%`;
  }
  return `${pct.toFixed(2)}%`;
}

export function isUpgradeUnlocked(upgrade, upgrades) {
  if (!upgrade.unlockAfter || upgrade.level > 0) {
    return true;
  }

  const prerequisite = upgrades.find((item) => item.id === upgrade.unlockAfter);
  return prerequisite?.level > 0;
}

function calculateStats(state) {
  const clickExtra = state.upgrades
    .filter((upgrade) => upgrade.type === 'click')
    .reduce((sum, upgrade) => sum.plus(toDecimal(upgrade.baseValue).times(upgrade.level)), new Decimal(0));

  const autoRate = state.upgrades
    .filter((upgrade) => upgrade.type === 'auto')
    .reduce((sum, upgrade) => sum.plus(getGeneratorAutoRate(state, upgrade)), new Decimal(0));

  const metaMultiplier = getPurchasedBoosts(state.boosts)
    .filter((boost) => boost.kind === 'global' || boost.kind === 'base_multiplier')
    .reduce((multiplier, boost) => multiplier.times(toDecimal(boost.multiplier)), new Decimal(1));

  const achievementMultiplier = getAchievementIdleMultiplier(state.unlockedAchievements ?? []);
  const ascensionTokensMultiplier = getAscensionTokenIdleMultiplier(state.ascensionTokens ?? 0);
  const productionMultiplier = metaMultiplier.times(achievementMultiplier).times(ascensionTokensMultiplier);

  const perSecond = autoRate.times(productionMultiplier);

  const clickPerSecondShare = getPurchasedBoosts(state.boosts)
    .filter((boost) => boost.kind === 'click_per_second')
    .reduce((sum, boost) => sum.plus(toDecimal(boost.clickPerSecondShare ?? 0)), new Decimal(0));

  const perClick = new Decimal(1).plus(clickExtra).plus(perSecond.times(clickPerSecondShare));

  return {
    perClick,
    perSecond,
    productionMultiplier,
    metaMultiplier,
    achievementMultiplier,
    ascensionTokensMultiplier,
  };
}

function createInitialState(upgrades, boosts = []) {
  const state = {
    coins: new Decimal(0),
    totalCoinsEarned: new Decimal(0),
    coinsThisAscension: new Decimal(0),
    totalClicks: 0,
    ascensionTokens: 0,
    prestigeCount: 0,
    unlockedAchievements: [],
    perClick: new Decimal(1),
    perSecond: new Decimal(0),
    autoTapProgress: 0,
    lastAutoTaps: 0,
    upgrades: cloneUpgrades(upgrades),
    boosts: cloneBoosts(boosts),
  };

  return recalculateState(state);
}

function syncAchievements(state) {
  const unlocked = new Set(state.unlockedAchievements ?? []);
  let changed = false;

  ACHIEVEMENTS.forEach((achievement) => {
    if (unlocked.has(achievement.id)) {
      return;
    }
    try {
      if (achievement.check(state)) {
        unlocked.add(achievement.id);
        changed = true;
      }
    } catch {
      // Ignore bad checks against partial state.
    }
  });

  state.unlockedAchievements = [...unlocked];
  if (changed) {
    recalculateState(state);
  }
  return changed;
}

function creditCoins(state, amount) {
  const gain = toDecimal(amount);
  if (gain.lte(0)) {
    return gain;
  }
  state.coins = state.coins.plus(gain);
  state.totalCoinsEarned = toDecimal(state.totalCoinsEarned).plus(gain);
  state.coinsThisAscension = toDecimal(state.coinsThisAscension).plus(gain);
  return gain;
}

function recalculateState(state) {
  const stats = calculateStats(state);
  state.perClick = stats.perClick;
  state.perSecond = stats.perSecond;
  state.productionMultiplier = stats.productionMultiplier;
  return state;
}

function findLoadedUpgrade(loadedUpgrades, catalogId) {
  if (!Array.isArray(loadedUpgrades)) {
    return null;
  }

  const direct = loadedUpgrades.find((entry) => entry.id === catalogId);
  const legacyId = Object.keys(UPGRADE_ID_ALIASES).find((oldId) => UPGRADE_ID_ALIASES[oldId] === catalogId);
  const legacy = legacyId ? loadedUpgrades.find((entry) => entry.id === legacyId) : null;
  const aliased = loadedUpgrades.find((entry) => UPGRADE_ID_ALIASES[entry.id] === catalogId);

  const candidates = [direct, legacy, aliased].filter(Boolean);
  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, entry) => {
    const level = Number.isFinite(Number(entry.level)) ? Number(entry.level) : 0;
    const bestLevel = Number.isFinite(Number(best.level)) ? Number(best.level) : 0;
    return level >= bestLevel ? entry : best;
  });
}

function findLoadedBoost(loadedBoosts, catalogId) {
  if (!Array.isArray(loadedBoosts)) {
    return null;
  }

  const direct = loadedBoosts.find((entry) => entry.id === catalogId);
  if (direct?.purchased) {
    return direct;
  }

  const legacyId = Object.keys(BOOST_ID_ALIASES).find((oldId) => BOOST_ID_ALIASES[oldId] === catalogId);
  const legacy = legacyId ? loadedBoosts.find((entry) => entry.id === legacyId) : null;
  const aliased = loadedBoosts.find((entry) => BOOST_ID_ALIASES[entry.id] === catalogId);

  return [direct, legacy, aliased].find((entry) => entry?.purchased) ?? direct ?? legacy ?? aliased ?? null;
}

function mergeStateFromSave(state, loaded) {
  if (!loaded) {
    return state;
  }

  // Remap legacy ids (generator-N → upgrade-N, efficiency aliases) before merge.
  // Do NOT re-run legacy star compensation here — that belongs only in old migrations.
  const normalized = normalizeSaveState(loaded);

  state.coins = normalized.coins !== undefined ? toDecimal(normalized.coins) : state.coins;
  state.totalCoinsEarned =
    normalized.totalCoinsEarned !== undefined
      ? toDecimal(normalized.totalCoinsEarned)
      : Decimal.max(state.totalCoinsEarned, state.coins);
  state.coinsThisAscension =
    normalized.coinsThisAscension !== undefined
      ? toDecimal(normalized.coinsThisAscension)
      : toDecimal(state.totalCoinsEarned);
  state.ascensionTokens = Number.isFinite(Number(normalized.ascensionTokens))
    ? Math.max(0, Number(normalized.ascensionTokens))
    : state.ascensionTokens;
  state.prestigeCount = Number.isFinite(Number(normalized.prestigeCount))
    ? Math.max(0, Number(normalized.prestigeCount))
    : state.prestigeCount;
  state.unlockedAchievements = Array.isArray(normalized.unlockedAchievements)
    ? normalized.unlockedAchievements.filter((id) => typeof id === 'string')
    : state.unlockedAchievements;
  state.totalClicks = Number.isFinite(Number(normalized.totalClicks)) ? Number(normalized.totalClicks) : state.totalClicks;
  state.autoTapProgress = Number.isFinite(Number(normalized.autoTapProgress))
    ? Math.max(0, Number(normalized.autoTapProgress))
    : state.autoTapProgress;

  state.upgrades = state.upgrades.map((upgrade) => {
    const existing = findLoadedUpgrade(normalized.upgrades, upgrade.id);
    const level = Number.isFinite(Number(existing?.level)) ? Math.max(0, Number(existing.level)) : 0;
    return existing ? { ...upgrade, level } : upgrade;
  });

  state.boosts = state.boosts.map((boost) => {
    const existing = findLoadedBoost(normalized.boosts, boost.id);
    return { ...boost, purchased: existing?.purchased === true };
  });

  recalculateState(state);
  syncAchievements(state);
  return state;
}

function buyUpgrade(state, upgradeId, buyAmount = 1) {
  const upgrade = state.upgrades.find((item) => item.id === upgradeId);

  if (!upgrade) {
    return { ok: false, reason: 'missing-upgrade' };
  }

  if (!isUpgradeUnlocked(upgrade, state.upgrades)) {
    return { ok: false, reason: 'locked' };
  }

  const amount = resolveBuyAmount(state, upgrade, buyAmount);
  if (amount <= 0) {
    return { ok: false, reason: 'insufficient-coins', cost: calculateUpgradeCost(upgrade), amount: 0 };
  }

  const cost = calculateBulkUpgradeCost(upgrade, amount);
  if (state.coins.lt(cost)) {
    return { ok: false, reason: 'insufficient-coins', cost, amount };
  }

  state.coins = state.coins.minus(cost);
  upgrade.level += amount;
  recalculateState(state);

  return {
    ok: true,
    cost,
    amount,
  };
}

function buyMetaUpgrade(state, boostId) {
  const boost = state.boosts.find((item) => item.id === boostId);

  if (!boost || boost.purchased) {
    return { ok: false, reason: boost ? 'already-purchased' : 'missing-boost' };
  }

  if (!isMetaUpgradeUnlocked(state, boost)) {
    return { ok: false, reason: 'locked' };
  }

  const cost = toDecimal(boost.cost).floor();
  if (state.coins.lt(cost)) {
    return { ok: false, reason: 'insufficient-coins', cost };
  }

  state.coins = state.coins.minus(cost);
  boost.purchased = true;
  recalculateState(state);

  return { ok: true, cost, boost };
}

function applyAutoIncome(state, seconds = 1) {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;

  if (state.perSecond.lte(0) || safeSeconds <= 0) {
    return new Decimal(0);
  }

  const gain = state.perSecond.times(safeSeconds);
  return creditCoins(state, gain);
}

function getAutoTapLevel(state) {
  return state.upgrades.find((upgrade) => upgrade.type === 'auto_tap')?.level ?? 0;
}

export function getAutoTapCursorCount(state) {
  return getAutoTapLevel(state);
}

function getAutoTapWaveWhiteEquivalents(level) {
  const maxSlots = getMaxAutoTapCursorSlots();
  const count = Math.min(level, maxSlots);

  if (level <= 0 || count <= 0) {
    return new Decimal(0);
  }

  let sum = new Decimal(0);
  for (let i = 0; i < level; i += 1) {
    const tier = getAutoTapCursorTier(level, i % count, maxSlots);
    sum = sum.plus(tier + 1);
  }

  return sum;
}

function applyAutoTaps(state, seconds = 1, intervalSeconds = AUTO_TAP_INTERVAL_SECONDS) {
  const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Number(seconds)) : 0;
  const level = getAutoTapLevel(state);

  if (level <= 0 || safeSeconds <= 0 || intervalSeconds <= 0) {
    return { gain: new Decimal(0), taps: 0 };
  }

  state.autoTapProgress = (state.autoTapProgress ?? 0) + safeSeconds;
  const waves = Math.floor(state.autoTapProgress / intervalSeconds);

  if (waves <= 0) {
    return { gain: new Decimal(0), taps: 0 };
  }

  state.autoTapProgress -= waves * intervalSeconds;
  const taps = waves * level;
  const whiteClickEquivalents = getAutoTapWaveWhiteEquivalents(level).times(waves);
  const gain = state.perClick.times(whiteClickEquivalents);
  state.coins = state.coins.plus(gain);
  state.totalCoinsEarned = toDecimal(state.totalCoinsEarned).plus(gain);
  state.coinsThisAscension = toDecimal(state.coinsThisAscension).plus(gain);
  state.totalClicks += Number(whiteClickEquivalents.toFixed(0));

  return { gain, taps };
}

function toTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function applyOfflineProgress(state, lastSavedAt, nowMs = Date.now(), maxOfflineSeconds = Number.POSITIVE_INFINITY) {
  const savedAtMs = toTimestampMs(lastSavedAt);

  if (!savedAtMs || nowMs <= savedAtMs) {
    return { gain: new Decimal(0), elapsedSeconds: 0 };
  }

  const elapsedSeconds = Math.floor((nowMs - savedAtMs) / 1000);
  const cappedSeconds =
    Number.isFinite(maxOfflineSeconds) && maxOfflineSeconds > 0
      ? Math.max(0, Math.min(elapsedSeconds, maxOfflineSeconds))
      : Math.max(0, elapsedSeconds);
  const income = applyAutoIncome(state, cappedSeconds);
  const autoTaps = applyAutoTaps(state, cappedSeconds);
  syncAchievements(state);

  return {
    gain: income.plus(autoTaps.gain),
    elapsedSeconds: cappedSeconds,
  };
}

function runPrestige(state) {
  const tokensGained = calculateAscensionTokenGain(state.coinsThisAscension);
  if (tokensGained <= 0) {
    return { ok: false, reason: 'no-tokens', tokensGained: 0 };
  }

  state.ascensionTokens = (state.ascensionTokens | 0) + tokensGained;
  state.prestigeCount = (state.prestigeCount | 0) + 1;
  state.coins = new Decimal(0);
  state.coinsThisAscension = new Decimal(0);
  state.autoTapProgress = 0;
  state.lastAutoTaps = 0;
  state.upgrades = state.upgrades.map((upgrade) => ({ ...upgrade, level: 0 }));
  state.boosts = state.boosts.map((boost) => ({ ...boost, purchased: false }));
  recalculateState(state);
  syncAchievements(state);
  return { ok: true, tokensGained, ascensionTokens: state.ascensionTokens };
}

function serializeState(state) {
  return {
    coins: state.coins.toString(),
    totalCoinsEarned: toDecimal(state.totalCoinsEarned).toString(),
    coinsThisAscension: toDecimal(state.coinsThisAscension).toString(),
    totalClicks: state.totalClicks,
    ascensionTokens: state.ascensionTokens | 0,
    prestigeCount: state.prestigeCount | 0,
    unlockedAchievements: [...(state.unlockedAchievements ?? [])],
    autoTapProgress: state.autoTapProgress ?? 0,
    upgrades: state.upgrades.map((upgrade) => ({ id: upgrade.id, level: upgrade.level })),
    boosts: state.boosts.map((boost) => ({ id: boost.id, purchased: boost.purchased })),
    savedAt: Date.now(),
  };
}

export function createClickerController(upgrades, boosts = []) {
  const state = createInitialState(upgrades, boosts);

  return {
    state,
    hydrate(saveData, options = {}) {
      const nowMs = options.nowMs ?? Date.now();
      const maxOfflineSeconds = options.maxOfflineSeconds ?? Number.POSITIVE_INFINITY;

      mergeStateFromSave(state, saveData);
      syncAchievements(state);

      const offline = applyOfflineProgress(state, saveData?.savedAt, nowMs, maxOfflineSeconds);
      syncAchievements(state);
      return offline;
    },
    tap() {
      creditCoins(state, state.perClick);
      state.totalClicks += 1;
      syncAchievements(state);
      return state.perClick;
    },
    tick(seconds = 1) {
      const income = applyAutoIncome(state, seconds);
      const autoTaps = applyAutoTaps(state, seconds);
      state.lastAutoTaps = autoTaps.taps;
      syncAchievements(state);
      return income.plus(autoTaps.gain);
    },
    tryBuyUpgrade(upgradeId, buyAmount = 1) {
      const result = buyUpgrade(state, upgradeId, buyAmount);
      if (result.ok) {
        syncAchievements(state);
      }
      return result;
    },
    tryBuyMetaUpgrade(boostId) {
      const result = buyMetaUpgrade(state, boostId);
      if (result.ok) {
        syncAchievements(state);
      }
      return result;
    },
    tryPrestige() {
      return runPrestige(state);
    },
    getMultiplierBreakdown() {
      const stats = calculateStats(state);
      return {
        metaMultiplier: stats.metaMultiplier,
        achievementMultiplier: stats.achievementMultiplier,
        ascensionTokensMultiplier: stats.ascensionTokensMultiplier,
        productionMultiplier: stats.productionMultiplier,
        ascensionTokens: state.ascensionTokens | 0,
      };
    },
    getPrestigePreview() {
      return {
        ascensionTokens: state.ascensionTokens | 0,
        ascensionTokensGain: calculateAscensionTokenGain(state.coinsThisAscension),
        ascensionTokensMultiplier: getAscensionTokenIdleMultiplier(state.ascensionTokens | 0),
        achievementMultiplier: getAchievementIdleMultiplier(state.unlockedAchievements ?? []),
        prestigeCount: state.prestigeCount | 0,
      };
    },
    getUpgradeCost(upgradeId, buyAmount = 1) {
      const upgrade = state.upgrades.find((item) => item.id === upgradeId);
      if (!upgrade) {
        return null;
      }
      const amount = resolveBuyAmount(state, upgrade, buyAmount);
      if (amount <= 0) {
        return calculateUpgradeCost(upgrade);
      }
      return calculateBulkUpgradeCost(upgrade, amount);
    },
    getUpgradeBuyPreview(upgradeId, buyAmount = 1) {
      const upgrade = state.upgrades.find((item) => item.id === upgradeId);
      if (!upgrade) {
        return null;
      }
      const amount = resolveBuyAmount(state, upgrade, buyAmount);
      const cost = amount > 0 ? calculateBulkUpgradeCost(upgrade, amount) : calculateUpgradeCost(upgrade);
      return {
        amount,
        cost,
        canBuy: amount > 0 && state.coins.gte(cost),
      };
    },
    snapshot() {
      return serializeState(state);
    },
  };
}
