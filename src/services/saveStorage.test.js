import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { SAVE_KEY, SAVE_VERSION } from '../config/gameConfig.js';
import { META_UPGRADES } from '../data/metaUpgrades.js';
import { CLICKER_GENERATORS } from '../data/generators.js';
import { CLICK_UPGRADES } from '../data/upgrades.js';
import { createClickerController } from '../lib/clickerMath.js';
import { computeChecksum, loadGameState, saveGameState, unpackEnvelope } from './saveStorage.js';

describe('saveStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips a save with checksum', () => {
    saveGameState({
      coins: '42',
      totalClicks: 3,
      upgrades: [{ id: 'tap-power', level: 1 }],
      boosts: [],
    });

    const loaded = loadGameState();
    expect(loaded.coins).toBe('42');
    expect(loaded.totalClicks).toBe(3);
    expect(loaded.upgrades[0].level).toBe(1);
  });

  it('salvages payload when checksum fails', () => {
    const state = { coins: '99', upgrades: [{ id: 'tap-power', level: 2 }], boosts: [] };
    const payload = JSON.stringify(state);
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: SAVE_VERSION,
        payload,
        checksum: 'deadbeef',
      }),
    );

    const loaded = loadGameState();
    expect(loaded.coins).toBe('99');
  });

  it('loads legacy plain JSON as schema v1', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ coins: '7', upgrades: [], boosts: [] }));
    const loaded = loadGameState();
    expect(loaded.coins).toBe('7');
    expect(loaded.ascensionTokens).toBe(0);
  });

  it('upgrades a v7 envelope with stars into Ascension Tokens and rewrites storage', () => {
    const state = {
      coins: '1234',
      totalCoinsEarned: '50000',
      coinsThisAscension: '12000',
      totalClicks: 40,
      stars: 15,
      prestigeCount: 3,
      unlockedAchievements: ['taps-100'],
      upgrades: [
        { id: 'upgrade-1', level: 25 },
        { id: 'tap-power', level: 2 },
      ],
      boosts: [{ id: 'upgrade-1-efficiency-1', purchased: true }],
      savedAt: 1_700_000_000_000,
    };
    const payload = JSON.stringify(state);
    const version = 7;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version,
        payload,
        checksum: computeChecksum(`${payload}:${SAVE_KEY}:${version}`),
      }),
    );

    const loaded = loadGameState();
    expect(loaded.coins).toBe('1234');
    expect(loaded.ascensionTokens).toBe(15);
    expect(loaded.stars).toBeUndefined();
    expect(loaded.prestigeCount).toBe(3);
    expect(loaded.unlockedAchievements).toEqual(['taps-100']);
    expect(loaded.upgrades).toEqual(
      expect.arrayContaining([
        { id: 'upgrade-1', level: 25 },
        { id: 'tap-power', level: 2 },
      ]),
    );

    const rewritten = JSON.parse(localStorage.getItem(SAVE_KEY));
    expect(rewritten.version).toBe(SAVE_VERSION);
    const rewrittenState = JSON.parse(rewritten.payload);
    expect(rewrittenState.ascensionTokens).toBe(15);
    expect(rewrittenState.stars).toBeUndefined();

    const controller = createClickerController([...CLICK_UPGRADES, ...CLICKER_GENERATORS], META_UPGRADES);
    controller.hydrate(loaded, { nowMs: loaded.savedAt, maxOfflineSeconds: 0 });
    expect(controller.state.ascensionTokens).toBe(15);
    expect(controller.state.prestigeCount).toBe(3);
    expect(controller.state.coins.toString()).toBe('1234');
    expect(controller.getMultiplierBreakdown().ascensionTokensMultiplier).toBe(1.15);
  });

  it('loads a pre-prestige v6 envelope without wiping progress', () => {
    const state = {
      coins: '888',
      totalCoinsEarned: '2000',
      totalClicks: 12,
      upgrades: [{ id: 'upgrade-1', level: 10 }],
      boosts: [
        { id: 'cps-tap-1', purchased: true },
        { id: 'upgrade-1-efficiency-1', purchased: true },
      ],
      savedAt: 1_700_000_000_000,
    };
    const payload = JSON.stringify(state);
    const version = 6;
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version,
        payload,
        checksum: computeChecksum(`${payload}:${SAVE_KEY}:${version}`),
      }),
    );

    const loaded = loadGameState();
    expect(loaded.coins).toBe('888');
    expect(loaded.totalCoinsEarned).toBe('2000');
    expect(loaded.coinsThisAscension).toBe('2000');
    expect(loaded.ascensionTokens).toBe(0);
    expect(loaded.boosts).toEqual(
      expect.arrayContaining([
        { id: 'click-per-second-tap-1', purchased: true },
        { id: 'upgrade-1-efficiency-1', purchased: true },
      ]),
    );

    const controller = createClickerController([...CLICK_UPGRADES, ...CLICKER_GENERATORS], META_UPGRADES);
    controller.hydrate(loaded, { nowMs: loaded.savedAt, maxOfflineSeconds: 0 });
    expect(controller.state.coins.toString()).toBe('888');
    expect(controller.state.upgrades.find((item) => item.id === 'upgrade-1')?.level).toBe(10);
  });

  it('unpacks verified envelopes', () => {
    const state = { coins: '1', upgrades: [] };
    const payload = JSON.stringify(state);
    const version = 2;
    const checksum = computeChecksum(`${payload}:${SAVE_KEY}:${version}`);
    const unpacked = unpackEnvelope({ version, payload, checksum }, SAVE_KEY);
    expect(unpacked.verified).toBe(true);
    expect(unpacked.state.coins).toBe('1');
  });
});
