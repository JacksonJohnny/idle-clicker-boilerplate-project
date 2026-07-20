import Decimal from 'decimal.js';

const NUMBER_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

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

function formatDecimalForSuffix(value) {
  const fixed = value.toFixed(value.gte(100) ? 0 : value.gte(10) ? 1 : 2);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function cloneUpgrades(upgrades) {
  return upgrades.map((upgrade) => ({ ...upgrade, level: 0 }));
}

function cloneBoosts(boosts) {
  return boosts.map((boost) => ({ ...boost, purchased: false }));
}

export function formatCoins(value) {
  const amount = toDecimal(value);

  if (!amount.isFinite() || amount.isNaN()) {
    return '0';
  }

  if (amount.abs().lt(1000)) {
    return amount.floor().toFixed(0);
  }

  const group = Math.floor(amount.e / 3);

  if (group > 0 && group < NUMBER_SUFFIXES.length) {
    const scaled = amount.div(Decimal.pow(10, group * 3));
    return `${formatDecimalForSuffix(scaled)}${NUMBER_SUFFIXES[group]}`;
  }

  return amount.toExponential(2).replace('e+', 'e');
}

function calculateUpgradeCost(upgrade) {
  const baseCost = toDecimal(upgrade.baseCost);
  const growth = toDecimal(upgrade.growth);
  return baseCost.times(growth.pow(upgrade.level)).floor();
}

export function getReachedMilestones(upgrade) {
  return (upgrade.milestones ?? []).filter((level) => upgrade.level >= level);
}

export function isUpgradeUnlocked(upgrade, upgrades) {
  if (!upgrade.unlockAfter || upgrade.level > 0) {
    return true;
  }

  const prerequisite = upgrades.find((item) => item.id === upgrade.unlockAfter);
  return prerequisite?.level > 0;
}

function calculateStats(upgrades, boosts = []) {
  const clickExtra = upgrades
    .filter((upgrade) => upgrade.type === 'click')
    .reduce((sum, upgrade) => sum.plus(toDecimal(upgrade.baseValue).times(upgrade.level)), new Decimal(0));

  const autoRate = upgrades
    .filter((upgrade) => upgrade.type === 'auto')
    .reduce((sum, upgrade) => {
      const milestoneMultiplier = Decimal.pow(2, getReachedMilestones(upgrade).length);
      return sum.plus(toDecimal(upgrade.baseValue).times(upgrade.level).times(milestoneMultiplier));
    }, new Decimal(0));

  const productionMultiplier = boosts
    .filter((boost) => boost.purchased)
    .reduce((multiplier, boost) => multiplier.times(toDecimal(boost.multiplier)), new Decimal(1));

  return {
    perClick: new Decimal(1).plus(clickExtra),
    perSecond: autoRate.times(productionMultiplier),
    productionMultiplier,
  };
}

function createInitialState(upgrades, boosts = []) {
  const state = {
    coins: new Decimal(0),
    totalClicks: 0,
    perClick: new Decimal(1),
    perSecond: new Decimal(0),
    upgrades: cloneUpgrades(upgrades),
    boosts: cloneBoosts(boosts),
  };

  return recalculateState(state);
}

function recalculateState(state) {
  const stats = calculateStats(state.upgrades, state.boosts);
  state.perClick = stats.perClick;
  state.perSecond = stats.perSecond;
  state.productionMultiplier = stats.productionMultiplier;
  return state;
}

function mergeStateFromSave(state, loaded) {
  if (!loaded) {
    return state;
  }

  state.coins = loaded.coins !== undefined ? toDecimal(loaded.coins) : state.coins;
  state.totalClicks = Number.isFinite(Number(loaded.totalClicks)) ? Number(loaded.totalClicks) : state.totalClicks;

  state.upgrades = state.upgrades.map((upgrade) => {
    const existing = loaded.upgrades?.find((entry) => entry.id === upgrade.id);
    const level = Number.isFinite(Number(existing?.level)) ? Math.max(0, Number(existing.level)) : 0;
    return existing ? { ...upgrade, level } : upgrade;
  });

  state.boosts = state.boosts.map((boost) => {
    const existing = loaded.boosts?.find((entry) => entry.id === boost.id);
    return { ...boost, purchased: existing?.purchased === true };
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

  const previousMilestoneCount = getReachedMilestones(upgrade).length;
  state.coins = state.coins.minus(cost);
  upgrade.level += 1;
  recalculateState(state);

  const reachedMilestones = getReachedMilestones(upgrade);

  return {
    ok: true,
    cost,
    milestoneReached: reachedMilestones.length > previousMilestoneCount ? reachedMilestones.at(-1) : null,
  };
}

function buyBoost(state, boostId) {
  const boost = state.boosts.find((item) => item.id === boostId);

  if (!boost || boost.purchased) {
    return { ok: false, reason: boost ? 'already-purchased' : 'missing-boost' };
  }

  const highestGeneratorLevel = state.upgrades
    .filter((upgrade) => upgrade.type === 'auto')
    .reduce((highest, upgrade) => Math.max(highest, upgrade.level), 0);

  if (highestGeneratorLevel < boost.requiredLevel) {
    return { ok: false, reason: 'locked' };
  }

  const cost = toDecimal(boost.cost);
  if (state.coins.lt(cost)) {
    return { ok: false, reason: 'insufficient-coins', cost };
  }

  state.coins = state.coins.minus(cost);
  boost.purchased = true;
  recalculateState(state);

  return { ok: true, cost };
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
  const gain = applyAutoIncome(state, cappedSeconds);

  return {
    gain,
    elapsedSeconds: cappedSeconds,
  };
}

function serializeState(state) {
  return {
    coins: state.coins.toString(),
    totalClicks: state.totalClicks,
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
      return applyAutoIncome(state, seconds);
    },
    tryBuyUpgrade(upgradeId) {
      return buyUpgrade(state, upgradeId);
    },
    tryBuyBoost(boostId) {
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
