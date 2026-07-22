import { describe, expect, it } from 'vitest';
import {
  compensateLegacyMilestoneStars,
  migrateSaveState,
  normalizeSaveState,
} from './saveMigrations.js';

describe('saveMigrations', () => {
  it('normalizes missing fields without wiping coins', () => {
    const normalized = normalizeSaveState({
      coins: '12345',
      upgrades: [{ id: 'tap-power', level: 3 }],
    });

    expect(normalized.coins).toBe('12345');
    expect(normalized.totalClicks).toBe(0);
    expect(normalized.autoTapProgress).toBe(0);
    expect(normalized.upgrades).toEqual([{ id: 'tap-power', level: 3 }]);
    expect(normalized.boosts).toEqual([]);
  });

  it('migrates legacy schema v1 up to current version', () => {
    const { state, version } = migrateSaveState(
      {
        coins: 99,
        totalClicks: 4,
        upgrades: [{ id: 'tap-power', level: 2 }],
        boosts: [{ id: 'meta-1', purchased: true }],
        savedAt: 1_700_000_000_000,
      },
      1,
    );

    expect(version).toBe(10);
    expect(state.coins).toBe(99);
    expect(state.upgrades[0].level).toBe(2);
  });

  it('maps generator-N ids back to upgrade-N', () => {
    const normalized = normalizeSaveState({
      coins: '1',
      upgrades: [{ id: 'generator-3', level: 40 }],
      boosts: [{ id: 'generator-3-efficiency-1', purchased: true }],
    });

    expect(normalized.upgrades).toEqual([{ id: 'upgrade-3', level: 40 }]);
    expect(normalized.boosts).toEqual([{ id: 'upgrade-3-efficiency-1', purchased: true }]);
  });

  it('converts old milestone stars into purchased efficiency upgrades', () => {
    const compensated = compensateLegacyMilestoneStars({
      upgrades: [
        { id: 'upgrade-1', level: 50 },
        { id: 'tap-power', level: 100 },
      ],
      boosts: [],
    });

    expect(compensated.boosts).toEqual([
      { id: 'upgrade-1-efficiency-1', purchased: true },
      { id: 'upgrade-1-efficiency-2', purchased: true },
      { id: 'upgrade-1-efficiency-3', purchased: true },
    ]);
  });

  it('runs star compensation when upgrading save from v2', () => {
    const { state, version } = migrateSaveState(
      {
        coins: '10',
        upgrades: [{ id: 'upgrade-2', level: 10 }],
        boosts: [{ id: 'first-surge', purchased: true }],
      },
      2,
    );

    expect(version).toBe(10);
    expect(state.boosts).toEqual(
      expect.arrayContaining([
        { id: 'upgrade-2-efficiency-1', purchased: true },
        { id: 'global-production-1', purchased: true },
      ]),
    );
  });

  it('renames stars to ascensionTokens on v7→v8', () => {
    const { state, version } = migrateSaveState(
      {
        coins: '1',
        stars: 12,
        prestigeCount: 2,
        coinsThisAscension: '0',
        unlockedAchievements: [],
      },
      7,
    );

    expect(version).toBe(10);
    expect(state.ascensionTokens).toBe(12);
    expect(state.stars).toBeUndefined();
  });

  it('normalize maps stars even without running migrations', () => {
    const normalized = normalizeSaveState({
      coins: '10',
      stars: 7,
      upgrades: [],
    });

    expect(normalized.ascensionTokens).toBe(7);
    expect(normalized.stars).toBeUndefined();
    expect(normalized.prestigeCount).toBe(0);
    expect(normalized.unlockedAchievements).toEqual([]);
    expect(normalized.coinsThisAscension).toBe('10');
  });

  it('preserves full progress when migrating a rich v6 save to current', () => {
    // A real v6 save already passed star→efficiency compensation in v3; boosts are stored.
    const { state, version } = migrateSaveState(
      {
        coins: '500000',
        totalCoinsEarned: '900000',
        totalClicks: 250,
        upgrades: [
          { id: 'tap-power', level: 5 },
          { id: 'auto-tap', level: 3 },
          { id: 'upgrade-1', level: 40 },
          { id: 'upgrade-2', level: 10 },
        ],
        boosts: [
          { id: 'upgrade-1-efficiency-1', purchased: true },
          { id: 'upgrade-1-efficiency-2', purchased: true },
          { id: 'upgrade-2-efficiency-1', purchased: true },
          { id: 'first-surge', purchased: true },
          { id: 'geral-upgrade-1', purchased: true },
        ],
        savedAt: 1_700_000_000_000,
      },
      6,
    );

    expect(version).toBe(10);
    expect(state.coins).toBe('500000');
    expect(state.totalCoinsEarned).toBe('900000');
    expect(state.coinsThisAscension).toBe('900000');
    expect(state.ascensionTokens).toBe(0);
    expect(state.prestigeCount).toBe(0);
    expect(state.upgrades).toEqual(
      expect.arrayContaining([
        { id: 'upgrade-1', level: 40 },
        { id: 'upgrade-2', level: 10 },
      ]),
    );
    expect(state.boosts).toEqual(
      expect.arrayContaining([
        { id: 'upgrade-1-efficiency-1', purchased: true },
        { id: 'upgrade-1-efficiency-2', purchased: true },
        { id: 'upgrade-2-efficiency-1', purchased: true },
        { id: 'global-production-1', purchased: true },
        { id: 'base-multiplier-1', purchased: true },
      ]),
    );
  });

  it('migrates v8 saves through v9 and drops ownedModifiers at v10', () => {
    const { state, version } = migrateSaveState(
      {
        coins: '1000',
        upgrades: [],
        boosts: [],
        ascensionTokens: 3,
        ownedModifiers: ['mod-idle-1'],
      },
      8,
    );

    expect(version).toBe(10);
    expect(state.ascensionTokens).toBe(3);
    expect(state.ownedModifiers).toBeUndefined();
  });
});
