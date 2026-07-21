import Decimal from 'decimal.js';
import { AUTO_TAP_INTERVAL_SECONDS } from '../data/upgrades.js';
import {
  BOOST_ID_ALIASES,
  UPGRADE_ID_ALIASES,
  compensateLegacyMilestoneStars,
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
 * @property {'generator'|'global'|'click_cps'|'synergy'} kind
 * @property {boolean} [purchased]
 */

/**
 * @typedef {object} SaveSnapshot
 * @property {string|number} coins
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

  if (boost.kind === 'click_cps') {
    return state.totalClicks >= boost.requiredClicks;
  }

  if (boost.kind === 'synergy') {
    return (
      getUpgradeLevel(state, boost.leftId) >= boost.requiredOwnedLeft &&
      getUpgradeLevel(state, boost.rightId) >= boost.requiredOwnedRight
    );
  }

  return false;
}

function getPurchasedBoosts(boosts) {
  return boosts.filter((boost) => boost.purchased);
}

function getGeneratorProductionMultiplier(state, generatorId) {
  let multiplier = new Decimal(1);

  getPurchasedBoosts(state.boosts).forEach((boost) => {
    if (boost.kind === 'generator' && boost.targetId === generatorId) {
      multiplier = multiplier.times(toDecimal(boost.multiplier));
      return;
    }

    if (boost.kind !== 'synergy') {
      return;
    }

    if (boost.leftId === generatorId) {
      multiplier = multiplier.times(new Decimal(1).plus(toDecimal(boost.leftBonusPerRight).times(getUpgradeLevel(state, boost.rightId))));
    }

    if (boost.rightId === generatorId) {
      multiplier = multiplier.times(new Decimal(1).plus(toDecimal(boost.rightBonusPerLeft).times(getUpgradeLevel(state, boost.leftId))));
    }
  });

  return multiplier;
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
    .reduce((sum, upgrade) => {
      const generatorMult = getGeneratorProductionMultiplier(state, upgrade.id);
      return sum.plus(toDecimal(upgrade.baseValue).times(upgrade.level).times(generatorMult));
    }, new Decimal(0));

  const productionMultiplier = getPurchasedBoosts(state.boosts)
    .filter((boost) => boost.kind === 'global')
    .reduce((multiplier, boost) => multiplier.times(toDecimal(boost.multiplier)), new Decimal(1));

  const perSecond = autoRate.times(productionMultiplier);

  const clickCpsShare = getPurchasedBoosts(state.boosts)
    .filter((boost) => boost.kind === 'click_cps')
    .reduce((sum, boost) => sum.plus(toDecimal(boost.clickCpsShare)), new Decimal(0));

  return {
    perClick: new Decimal(1).plus(clickExtra).plus(perSecond.times(clickCpsShare)),
    perSecond,
    productionMultiplier,
  };
}

function createInitialState(upgrades, boosts = []) {
  const state = {
    coins: new Decimal(0),
    totalClicks: 0,
    perClick: new Decimal(1),
    perSecond: new Decimal(0),
    autoTapProgress: 0,
    lastAutoTaps: 0,
    upgrades: cloneUpgrades(upgrades),
    boosts: cloneBoosts(boosts),
  };

  return recalculateState(state);
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
  const normalized = compensateLegacyMilestoneStars(normalizeSaveState(loaded));

  state.coins = normalized.coins !== undefined ? toDecimal(normalized.coins) : state.coins;
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

  // Re-apply star → efficiency grants from restored generator levels (idempotent).
  const withStars = compensateLegacyMilestoneStars({
    upgrades: state.upgrades.map((upgrade) => ({ id: upgrade.id, level: upgrade.level })),
    boosts: state.boosts.map((boost) => ({ id: boost.id, purchased: boost.purchased })),
  });
  state.boosts = state.boosts.map((boost) => {
    const granted = withStars.boosts.find((entry) => entry.id === boost.id);
    return { ...boost, purchased: boost.purchased || granted?.purchased === true };
  });

  return recalculateState(state);
}

function buyUpgrade(state, upgradeId) {
  const upgrade = state.upgrades.find((item) => item.id === upgradeId);

  if (!upgrade) {
    return { ok: false, reason: 'missing-upgrade' };
  }

  if (!isUpgradeUnlocked(upgrade, state.upgrades)) {
    return { ok: false, reason: 'locked' };
  }

  const cost = calculateUpgradeCost(upgrade);

  if (state.coins.lt(cost)) {
    return { ok: false, reason: 'insufficient-coins', cost };
  }

  state.coins = state.coins.minus(cost);
  upgrade.level += 1;
  recalculateState(state);

  return {
    ok: true,
    cost,
  };
}

function buyBoost(state, boostId) {
  const boost = state.boosts.find((item) => item.id === boostId);

  if (!boost || boost.purchased) {
    return { ok: false, reason: boost ? 'already-purchased' : 'missing-boost' };
  }

  if (!isMetaUpgradeUnlocked(state, boost)) {
    return { ok: false, reason: 'locked' };
  }

  const cost = toDecimal(boost.cost);
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
  state.coins = state.coins.plus(gain);
  return gain;
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

function applyOfflineProgress(state, lastSavedAt, nowMs = Date.now(), maxOfflineSeconds = 8 * 60 * 60) {
  const savedAtMs = toTimestampMs(lastSavedAt);

  if (!savedAtMs || nowMs <= savedAtMs) {
    return { gain: new Decimal(0), elapsedSeconds: 0 };
  }

  const elapsedSeconds = Math.floor((nowMs - savedAtMs) / 1000);
  const cappedSeconds = Math.max(0, Math.min(elapsedSeconds, maxOfflineSeconds));
  const income = applyAutoIncome(state, cappedSeconds);
  const autoTaps = applyAutoTaps(state, cappedSeconds);

  return {
    gain: income.plus(autoTaps.gain),
    elapsedSeconds: cappedSeconds,
  };
}

function serializeState(state) {
  return {
    coins: state.coins.toString(),
    totalClicks: state.totalClicks,
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
      const maxOfflineSeconds = options.maxOfflineSeconds ?? 8 * 60 * 60;

      mergeStateFromSave(state, saveData);

      const offline = applyOfflineProgress(state, saveData?.savedAt, nowMs, maxOfflineSeconds);
      return offline;
    },
    tap() {
      state.coins = state.coins.plus(state.perClick);
      state.totalClicks += 1;
      return state.perClick;
    },
    tick(seconds = 1) {
      const income = applyAutoIncome(state, seconds);
      const autoTaps = applyAutoTaps(state, seconds);
      state.lastAutoTaps = autoTaps.taps;
      return income.plus(autoTaps.gain);
    },
    tryBuyUpgrade(upgradeId) {
      return buyUpgrade(state, upgradeId);
    },
    tryBuyBoost(boostId) {
      return buyBoost(state, boostId);
    },
    tryBuyMetaUpgrade(boostId) {
      return buyBoost(state, boostId);
    },
    getUpgradeCost(upgradeId) {
      const upgrade = state.upgrades.find((item) => item.id === upgradeId);
      return upgrade ? calculateUpgradeCost(upgrade) : null;
    },
    snapshot() {
      return serializeState(state);
    },
  };
}
