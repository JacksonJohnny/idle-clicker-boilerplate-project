import { describe, expect, it } from 'vitest';
import { META_UPGRADES } from '../data/metaUpgrades.js';
import { CLICKER_GENERATORS } from '../data/generators.js';
import { CLICK_UPGRADES } from '../data/upgrades.js';
import { createClickerController, formatCoins, formatIdleSharePercent, getGeneratorEfficiencyStarCount, getGeneratorIdleShare, isUpgradeUnlocked } from './clickerMath.js';

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
    // Own 10 G1 unlocks Starter Pack (+1% idle)
    expect(controller.state.perSecond.toString()).toBe('10.1');
  });

  it('reports idle production share per generator', () => {
    const controller = createController();
    controller.hydrate({
      coins: '0',
      upgrades: [
        { id: 'upgrade-1', level: 10 },
        { id: 'upgrade-2', level: 5 },
      ],
    });

    // upgrade-1 base 1 → 10; upgrade-2 base 8 → 40; total 50 → 20% / 80%
    expect(getGeneratorIdleShare(controller.state, 'upgrade-1')).toBeCloseTo(0.2, 5);
    expect(getGeneratorIdleShare(controller.state, 'upgrade-2')).toBeCloseTo(0.8, 5);
    expect(getGeneratorIdleShare(controller.state, 'upgrade-3')).toBeNull();
    expect(formatIdleSharePercent(0.2)).toBe('20%');
    expect(formatIdleSharePercent(0.012)).toBe('1.2%');
    expect(formatIdleSharePercent(0.0008)).toBe('0.08%');
    expect(formatIdleSharePercent(null)).toBeNull();
  });

  it('hides idle share when no generators produce', () => {
    const controller = createController();
    expect(getGeneratorIdleShare(controller.state, 'upgrade-1')).toBeNull();
  });

  it('remaps aliased generator ids and keeps only purchased efficiency from save', () => {
    const controller = createController();
    controller.hydrate({
      coins: '0',
      upgrades: [{ id: 'generator-1', level: 50 }],
      boosts: [{ id: 'generator-1-efficiency-1', purchased: true }],
    });

    expect(controller.state.upgrades.find((item) => item.id === 'upgrade-1')?.level).toBe(50);
    expect(controller.state.boosts.find((item) => item.id === 'upgrade-1-efficiency-1')?.purchased).toBe(true);
    // Ownership alone must not auto-grant later efficiency tiers on hydrate.
    expect(controller.state.boosts.find((item) => item.id === 'upgrade-1-efficiency-2')?.purchased).toBe(false);
    expect(controller.state.boosts.find((item) => item.id === 'upgrade-1-efficiency-3')?.purchased).toBe(false);
  });

  it('applies generator efficiency meta upgrades', () => {
    const controller = createController();
    controller.hydrate({
      coins: '100000',
      upgrades: [{ id: 'upgrade-1', level: 5 }],
    });

    expect(controller.state.perSecond.toString()).toBe('5');
    expect(getGeneratorEfficiencyStarCount(controller.state, 'upgrade-1')).toBe(0);
    expect(controller.tryBuyMetaUpgrade('upgrade-1-efficiency-1')).toMatchObject({ ok: true });
    // ×2 efficiency +1% achievement (Tuned Up)
    expect(controller.state.perSecond.toString()).toBe('10.1');
    expect(getGeneratorEfficiencyStarCount(controller.state, 'upgrade-1')).toBe(1);
  });

  it('applies global production and Clicks per second tap meta upgrades', () => {
    const controller = createController();
    controller.hydrate({
      coins: '100000000',
      totalClicks: 100,
      upgrades: [{ id: 'upgrade-1', level: 25 }],
      boosts: [
        { id: 'upgrade-1-efficiency-1', purchased: true },
        { id: 'upgrade-1-efficiency-2', purchased: true },
      ],
    });

    expect(controller.tryBuyMetaUpgrade('global-production-1')).toMatchObject({ ok: true });
    // 25×4 efficiency ×1.05 global ×1.04 achievements = 109.2
    expect(controller.state.perSecond.toString()).toBe('109.2');

    expect(controller.tryBuyMetaUpgrade('click-per-second-tap-1')).toMatchObject({ ok: true });
    expect(controller.state.perClick.toString()).toBe('2.092');
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
    expect(kinds).toEqual(new Set(['generator', 'global', 'click_per_second', 'base_multiplier']));
    expect(META_UPGRADES.filter((item) => item.kind === 'base_multiplier').length).toBe(20);
    expect(CLICKER_GENERATORS).toHaveLength(20);
    expect(META_UPGRADES.length).toBe(130);
    expect(META_UPGRADES.filter((item) => item.kind === 'generator').length).toBe(100);
    expect(META_UPGRADES.some((item) => item.id === 'upgrade-20-efficiency-1')).toBe(true);
  });

  it('applies base multiplier upgrades as multiplicative production boosts', () => {
    const controller = createController();
    controller.hydrate({
      coins: '2000000',
      totalCoinsEarned: '50000',
      upgrades: [{ id: 'upgrade-1', level: 1 }],
    });

    expect(controller.state.perSecond.toString()).toBe('1');
    expect(controller.tryBuyMetaUpgrade('base-multiplier-1')).toMatchObject({ ok: true });
    expect(controller.state.perSecond.toString()).toBe('1.01');
  });

  it('buys bulk upgrade amounts and respects MAX', () => {
    const controller = createController();
    controller.hydrate({
      coins: '100000',
      upgrades: [{ id: 'upgrade-1', level: 0 }],
    });

    const preview10 = controller.getUpgradeBuyPreview('upgrade-1', 10);
    expect(preview10.amount).toBe(10);
    expect(controller.tryBuyUpgrade('upgrade-1', 10)).toMatchObject({ ok: true, amount: 10 });
    expect(controller.state.upgrades.find((item) => item.id === 'upgrade-1')?.level).toBe(10);

    // Unnormalized string inputs should still resolve via normalizeBuyAmount.
    controller.hydrate({
      coins: '100000',
      upgrades: [{ id: 'upgrade-1', level: 0 }],
    });
    expect(controller.getUpgradeBuyPreview('upgrade-1', '25').amount).toBe(25);
    expect(controller.tryBuyUpgrade('upgrade-1', '10')).toMatchObject({ ok: true, amount: 10 });

    controller.hydrate({
      coins: '500',
      upgrades: [{ id: 'upgrade-1', level: 0 }],
    });
    const maxPreview = controller.getUpgradeBuyPreview('upgrade-1', 'max');
    expect(maxPreview.amount).toBeGreaterThan(0);
    expect(controller.tryBuyUpgrade('upgrade-1', 'max')).toMatchObject({ ok: true });
    expect(controller.state.upgrades.find((item) => item.id === 'upgrade-1')?.level).toBe(maxPreview.amount);
  });

  it('prestiges for Ascension Tokens and keeps permanent bonus', () => {
    const controller = createController();
    controller.hydrate({
      coins: '0',
      coinsThisAscension: '100000000',
      totalCoinsEarned: '100000000',
      upgrades: [{ id: 'upgrade-1', level: 10 }],
    });

    const preview = controller.getPrestigePreview();
    expect(preview.ascensionTokensGain).toBeGreaterThan(0);
    expect(controller.tryPrestige()).toMatchObject({ ok: true });
    expect(controller.state.ascensionTokens).toBe(preview.ascensionTokensGain);
    expect(controller.state.upgrades.find((item) => item.id === 'upgrade-1')?.level).toBe(0);
    expect(controller.state.coins.toString()).toBe('0');
    expect(controller.state.perSecond.toNumber()).toBe(0);
    expect(controller.getMultiplierBreakdown().ascensionTokensMultiplier).toBeGreaterThan(1);
  });
});
