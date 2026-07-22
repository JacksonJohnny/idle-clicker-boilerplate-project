import { SAVE_VERSION } from '../config/gameConfig.js';
import { CLICKER_GENERATORS } from '../data/generators.js';

/**
 * Canonical store generator ids are `upgrade-N` (stable for saves).
 * `generator-N` was a brief rename — map it back so those saves keep levels.
 */
export const UPGRADE_ID_ALIASES = {
  'generator-1': 'upgrade-1',
  'generator-2': 'upgrade-2',
  'generator-3': 'upgrade-3',
  'generator-4': 'upgrade-4',
  'generator-5': 'upgrade-5',
  'generator-6': 'upgrade-6',
  'generator-7': 'upgrade-7',
  'generator-8': 'upgrade-8',
  'generator-9': 'upgrade-9',
  'generator-10': 'upgrade-10',
  'generator-11': 'upgrade-11',
  'generator-12': 'upgrade-12',
  'generator-13': 'upgrade-13',
  'generator-14': 'upgrade-14',
  'generator-15': 'upgrade-15',
  'generator-16': 'upgrade-16',
  'generator-17': 'upgrade-17',
  'generator-18': 'upgrade-18',
  'generator-19': 'upgrade-19',
  'generator-20': 'upgrade-20',
};

const EFFICIENCY_TIER_COUNT = 5;
const GENERATOR_ALIAS_COUNT = 20;

function buildEfficiencyAliases() {
  const aliases = {
    'first-surge': 'global-production-1',
    'power-grid': 'global-production-2',
    'overdrive': 'global-production-3',
  };

  for (let n = 1; n <= GENERATOR_ALIAS_COUNT; n += 1) {
    for (let tier = 1; tier <= EFFICIENCY_TIER_COUNT; tier += 1) {
      aliases[`generator-${n}-efficiency-${tier}`] = `upgrade-${n}-efficiency-${tier}`;
    }
  }

  for (let tier = 1; tier <= 5; tier += 1) {
    aliases[`cps-tap-${tier}`] = `click-per-second-tap-${tier}`;
  }

  for (let n = 1; n <= 20; n += 1) {
    aliases[`geral-upgrade-${n}`] = `base-multiplier-${n}`;
  }

  return aliases;
}

export const BOOST_ID_ALIASES = buildEfficiencyAliases();

/** Pre-removal star thresholds: each reached tier gave ×2 to that generator. */
export const LEGACY_MILESTONE_THRESHOLDS = [10, 25, 50, 100, 200];

const GENERATOR_IDS = new Set(CLICKER_GENERATORS.map((generator) => generator.id));

const MIGRATIONS = [
  {
    from: 1,
    to: 2,
    migrate(state) {
      return normalizeSaveState(state);
    },
  },
  {
    from: 2,
    to: 3,
    migrate(state) {
      return compensateLegacyMilestoneStars(state);
    },
  },
  {
    from: 3,
    to: 4,
    migrate(state) {
      return normalizeSaveState(state);
    },
  },
  {
    from: 4,
    to: 5,
    migrate(state) {
      // Roll back brief generator-N rename → stable upgrade-N ids, then re-grant stars.
      return compensateLegacyMilestoneStars(normalizeSaveState(state));
    },
  },
  {
    from: 5,
    to: 6,
    migrate(state) {
      const next = normalizeSaveState(state);
      if (next.totalCoinsEarned === undefined && next.coins !== undefined) {
        next.totalCoinsEarned = next.coins;
      }
      return next;
    },
  },
  {
    from: 6,
    to: 7,
    migrate(state) {
      const next = normalizeSaveState(state);
      if (next.coinsThisAscension === undefined) {
        next.coinsThisAscension = next.totalCoinsEarned ?? next.coins ?? '0';
      }
      if (next.stars === undefined) {
        next.stars = 0;
      }
      if (next.prestigeCount === undefined) {
        next.prestigeCount = 0;
      }
      if (!Array.isArray(next.unlockedAchievements)) {
        next.unlockedAchievements = [];
      }
      return next;
    },
  },
  {
    from: 7,
    to: 8,
    migrate(state) {
      const next = normalizeSaveState(state);
      if (next.ascensionTokens === undefined) {
        next.ascensionTokens = Number.isFinite(Number(next.stars)) ? Math.max(0, Number(next.stars)) : 0;
      }
      delete next.stars;
      return next;
    },
  },
  {
    from: 8,
    to: 9,
    migrate(state) {
      const next = normalizeSaveState(state);
      if (!Array.isArray(next.ownedModifiers)) {
        next.ownedModifiers = [];
      }
      return next;
    },
  },
  {
    from: 9,
    to: 10,
    migrate(state) {
      const next = normalizeSaveState(state);
      delete next.ownedModifiers;
      return next;
    },
  },
];

function cloneSave(state) {
  return JSON.parse(JSON.stringify(state ?? {}));
}

function remapIds(entries, aliases) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }

    const id = aliases[entry.id] ?? entry.id;
    return id === entry.id ? entry : { ...entry, id };
  });
}

function dedupeBoosts(boosts) {
  const byId = new Map();

  for (const entry of boosts) {
    if (!entry?.id) {
      continue;
    }

    const previous = byId.get(entry.id);
    byId.set(entry.id, {
      id: entry.id,
      purchased: Boolean(previous?.purchased || entry.purchased),
    });
  }

  return [...byId.values()];
}

function dedupeUpgrades(upgrades) {
  const byId = new Map();

  for (const entry of upgrades) {
    if (!entry?.id) {
      continue;
    }

    const previous = byId.get(entry.id);
    const level = Math.max(
      Number.isFinite(Number(previous?.level)) ? Number(previous.level) : 0,
      Number.isFinite(Number(entry.level)) ? Number(entry.level) : 0,
    );
    byId.set(entry.id, { id: entry.id, level });
  }

  return [...byId.values()];
}

function markBoostPurchased(boosts, boostId) {
  const existing = boosts.find((entry) => entry.id === boostId);

  if (existing) {
    existing.purchased = true;
    return;
  }

  boosts.push({ id: boostId, purchased: true });
}

/**
 * Stars were automatic ×2 at 10/25/50/100/200 owned.
 * Grant the first N efficiency upgrades as purchased, where N = stars earned.
 */
export function compensateLegacyMilestoneStars(state) {
  const next = cloneSave(state);
  next.boosts = Array.isArray(next.boosts) ? next.boosts : [];
  next.upgrades = dedupeUpgrades(remapIds(next.upgrades, UPGRADE_ID_ALIASES).filter((entry) => entry?.id));

  for (const upgrade of next.upgrades ?? []) {
    if (!GENERATOR_IDS.has(upgrade.id)) {
      continue;
    }

    const level = Number.isFinite(Number(upgrade.level)) ? Math.max(0, Number(upgrade.level)) : 0;
    const stars = LEGACY_MILESTONE_THRESHOLDS.filter((threshold) => level >= threshold).length;
    const grants = Math.min(stars, EFFICIENCY_TIER_COUNT);

    for (let tier = 1; tier <= grants; tier += 1) {
      markBoostPurchased(next.boosts, `${upgrade.id}-efficiency-${tier}`);
    }
  }

  return next;
}

export function normalizeSaveState(state) {
  const next = cloneSave(state);

  if (next.coins === undefined || next.coins === null) {
    next.coins = '0';
  } else if (typeof next.coins !== 'string' && typeof next.coins !== 'number') {
    next.coins = '0';
  }

  next.totalClicks = Number.isFinite(Number(next.totalClicks)) ? Math.max(0, Number(next.totalClicks)) : 0;
  next.autoTapProgress = Number.isFinite(Number(next.autoTapProgress))
    ? Math.max(0, Number(next.autoTapProgress))
    : 0;
  next.upgrades = dedupeUpgrades(remapIds(next.upgrades, UPGRADE_ID_ALIASES).filter((entry) => entry?.id));
  next.boosts = dedupeBoosts(remapIds(next.boosts, BOOST_ID_ALIASES).filter((entry) => entry?.id));

  // Prestige currency rename: stars (v7) → ascensionTokens (v8+). Keep both paths safe.
  const fromTokens = Number.isFinite(Number(next.ascensionTokens)) ? Math.max(0, Number(next.ascensionTokens)) : null;
  const fromStars = Number.isFinite(Number(next.stars)) ? Math.max(0, Number(next.stars)) : null;
  next.ascensionTokens = fromTokens ?? fromStars ?? 0;
  delete next.stars;

  if (next.prestigeCount === undefined || !Number.isFinite(Number(next.prestigeCount))) {
    next.prestigeCount = 0;
  } else {
    next.prestigeCount = Math.max(0, Number(next.prestigeCount));
  }

  if (!Array.isArray(next.unlockedAchievements)) {
    next.unlockedAchievements = [];
  } else {
    next.unlockedAchievements = next.unlockedAchievements.filter((id) => typeof id === 'string');
  }

  // Drop removed modifier system (SAVE_VERSION 10+).
  delete next.ownedModifiers;

  if (next.coinsThisAscension === undefined || next.coinsThisAscension === null) {
    next.coinsThisAscension = next.totalCoinsEarned ?? next.coins ?? '0';
  }

  if (next.totalCoinsEarned === undefined || next.totalCoinsEarned === null) {
    next.totalCoinsEarned = next.coins ?? '0';
  }

  if (next.savedAt !== undefined && next.savedAt !== null) {
    const savedAt = Number(next.savedAt);
    next.savedAt = Number.isFinite(savedAt) ? savedAt : next.savedAt;
  }

  return next;
}

export function migrateSaveState(state, fromVersion = 1) {
  let version = Number.isFinite(Number(fromVersion)) ? Math.max(1, Number(fromVersion)) : 1;
  let next = normalizeSaveState(state);

  while (version < SAVE_VERSION) {
    const step = MIGRATIONS.find((migration) => migration.from === version);

    if (step) {
      next = normalizeSaveState(step.migrate(cloneSave(next)));
      version = step.to;
      continue;
    }

    version += 1;
  }

  return {
    state: next,
    version: SAVE_VERSION,
  };
}
