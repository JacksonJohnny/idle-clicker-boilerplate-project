import { describe, expect, it } from 'vitest';
import { MILESTONE_BOOSTS } from '../data/boosts.js';
import { CLICKER_GENERATORS } from '../data/generators.js';
import { CLICK_UPGRADES } from '../data/upgrades.js';
import { createClickerController, formatCoins, getReachedMilestones, isUpgradeUnlocked } from './clickerMath.js';

const createController = () => createClickerController([...CLICK_UPGRADES, ...CLICKER_GENERATORS], MILESTONE_BOOSTS);

describe('clickerMath', () => {
  it('formats small, suffixed and very large values', () => {
    expect(formatCoins(999)).toBe('999');
    expect(formatCoins(1500)).toBe('1.5K');
    expect(formatCoins(1_000_000)).toBe('1M');
    expect(formatCoins('1e40')).toMatch(/e40$/);
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

  it('reports and applies a generator milestone', () => {
    const controller = createController();
    controller.hydrate({ coins: '100000', upgrades: [{ id: 'upgrade-1', level: 9 }] });

    const result = controller.tryBuyUpgrade('upgrade-1');
    const generator = controller.state.upgrades.find((item) => item.id === 'upgrade-1');

    expect(result.milestoneReached).toBe(10);
    expect(getReachedMilestones(generator)).toEqual([10]);
    expect(controller.state.perSecond.toString()).toBe('20');
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

  it('purchases a boost only after its generator requirement', () => {
    const controller = createController();
    controller.hydrate({ coins: '25000', upgrades: [{ id: 'upgrade-1', level: 25 }] });

    const result = controller.tryBuyBoost('first-surge');

    expect(result.ok).toBe(true);
    expect(controller.state.productionMultiplier.toString()).toBe('2');
    expect(controller.state.perSecond.toString()).toBe('200');
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
});