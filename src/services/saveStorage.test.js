import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { SAVE_KEY, SAVE_VERSION } from '../config/gameConfig.js';
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
