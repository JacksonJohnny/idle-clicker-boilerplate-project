import { describe, expect, it } from 'vitest';
import { META_UPGRADES } from '../data/metaUpgrades.js';
import { CLICKER_GENERATORS } from '../data/generators.js';
import { CLICK_UPGRADES } from '../data/upgrades.js';
import { createClickerController, formatCoins, isUpgradeUnlocked } from './clickerMath.js';

const createController = () => createClickerController([...CLICK_UPGRADES, ...CLICKER_GENERATORS], META_UPGRADES);

describe('clickerMath', () => {
  it('formats small, suffixed and very large values', () => {
    expect(formatCoins(999)).toBe('999');
    expect(formatCoins(999.4)).toBe('999.4');
    expect(formatCoins(1500)).toBe('1,500');
    expect(formatCoins(705_026)).toBe('705,026');
    expect(formatCoins(1_014_000_000)).toBe('1.014 billion');
    expect(formatCoins(1_000_000)).toBe('1 million');
    expect(formatCoins('1e33')).toBe('1 decillion');
    expect(formatCoins('1e40')).toMatch(/e40$/);
  });

  it('drops scaled decimals when income already ticks the unit fast', () => {
    expect(formatCoins(388_557_000, { rate: 500_000 })).toBe('389 million');
    expect(formatCoins(388_557_000, { rate: 100 })).toBe('388.557 million');
  });

  it('buys an upgrade and recalculates tap power', () => {
    const controller = createController();
    controller.hydrate({ coins: '100' });

    const result = controller.tryBuyUpgrade('tap-power');

    expect(result.ok).toBe(true);
    expect(controller.state.coins.toString()).toBe('85');
    expect(controller.state.perClick.toString()).toBe('2');
  });

  it('keeps future generators locked until the previous one is owned', () => {
    const controller = createController();
    controller.hydrate({ coins: '100000' });

    expect(controller.tryBuyUpgrade('upgrade-2')).toMatchObject({ ok: false, reason: 'locked' });
    expect(isUpgradeUnlocked(controller.state.upgrades.find((item) => item.id === 'upgrade-2'), controller.state.upgrades)).toBe(false);

    controller.tryBuyUpgrade('upgrade-1');
    expect(isUpgradeUnlocked(controller.state.upgrades.find((item) => item.id === 'upgrade-2'), controller.state.upgrades)).toBe(true);
  });

  it('scales generator income linearly with level', () => {
    const controller = createController();
    controller.hydrate({ coins: '100000', upgrades: [{ id: 'upgrade-1', level: 9 }] });

    const result = controller.tryBuyUpgrade('upgrade-1');

    expect(result.ok).toBe(true);
    expect(controller.state.perSecond.toString()).toBe('10');
  });

  it('restores efficiency meta upgrades from aliased generator ids and star thresholds', () => {
    const controller = createController();
    controller.hydrate({
      coins: '0',
      upgrades: [{ id: 'generator-1', level: 50 }],
      boosts: [{ id: 'generator-1-efficiency-1', purchased: true }],
    });

    expect(controller.state.upgrades.find((item) => item.id === 'upgrade-1')?.level).toBe(50);
    expect(controller.state.boosts.find((item) => item.id === 'upgrade-1-efficiency-1')?.purchased).toBe(true);
    expect(controller.state.boosts.find((item) => item.id === 'upgrade-1-efficiency-2')?.purchased).toBe(true);
    expect(controller.state.boosts.find((item) => item.id === 'upgrade-1-efficiency-3')?.purchased).toBe(true);
  });

  it('applies generator efficiency meta upgrades', () => {
    const controller = createController();
    controller.hydrate({
      coins: '100000',
      upgrades: [{ id: 'upgrade-1', level: 1 }],
    });

    expect(controller.state.perSecond.toString()).toBe('1');
    expect(controller.tryBuyBoost('upgrade-1-efficiency-1')).toMatchObject({ ok: true });
    expect(controller.state.perSecond.toString()).toBe('2');
  });

  it('applies global production and click CPS meta upgrades', () => {
    const controller = createController();
    controller.hydrate({
      coins: '100000000',
      totalClicks: 100,
      upgrades: [{ id: 'upgrade-1', level: 25 }],
    });

    expect(controller.tryBuyBoost('global-production-1')).toMatchObject({ ok: true });
    // level 25 → star efficiencies ×4, then global ×1.05 → 25 * 4 * 1.05 = 105
    expect(controller.state.perSecond.toString()).toBe('105');

    expect(controller.tryBuyBoost('cps-tap-1')).toMatchObject({ ok: true });
    expect(controller.state.perClick.toString()).toBe('2.05');
  });

  it('applies synergy bonuses between paired generators', () => {
    const controller = createController();
    controller.hydrate({
      coins: '100000000',
      upgrades: [
        { id: 'upgrade-1', level: 15 },
        { id: 'upgrade-2', level: 15 },
      ],
    });

    expect(controller.tryBuyBoost('synergy-upgrade-1-upgrade-2')).toMatchObject({ ok: true });
    // Each gen has 1 star efficiency (×2) from owned 10; synergy on top → 296.1
    expect(controller.state.perSecond.toString()).toBe('296.1');
  });

  it('caps offline income at the configured duration', () => {
    const controller = createController();
    const nowMs = 1_000_000;
    const offline = controller.hydrate(
      { coins: '0', upgrades: [{ id: 'upgrade-1', level: 1 }], savedAt: nowMs - 20_000 },
      { nowMs, maxOfflineSeconds: 10 },
    );

    expect(offline.elapsedSeconds).toBe(10);
    expect(offline.gain.toString()).toBe('10');
    expect(controller.state.coins.toString()).toBe('10');
  });

  it('runs auto tap clicks on an interval', () => {
    const controller = createController();
    controller.hydrate({
      coins: '10000',
      upgrades: [
        { id: 'tap-power', level: 1 },
        { id: 'auto-tap', level: 2 },
      ],
    });

    const gain = controller.tick(10);
    expect(controller.state.lastAutoTaps).toBe(2);
    expect(gain.toString()).toBe('4');
    expect(controller.state.totalClicks).toBe(2);
  });

  it('serializes only durable state', () => {
    const controller = createController();
    controller.hydrate({ coins: '42', totalClicks: 7 });

    expect(controller.snapshot()).toMatchObject({
      coins: '42',
      totalClicks: 7,
      upgrades: expect.any(Array),
      boosts: expect.any(Array),
      savedAt: expect.any(Number),
    });
  });

  it('builds a genre-agnostic meta upgrade catalog', () => {
    const kinds = new Set(META_UPGRADES.map((item) => item.kind));
    expect(kinds).toEqual(new Set(['generator', 'global', 'click_cps', 'synergy']));
    expect(META_UPGRADES.length).toBeGreaterThan(40);
  });
});
