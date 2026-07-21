import Decimal from 'decimal.js';
import { CLICKER_GENERATORS } from './generators.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const GENERATOR_TIERS = [
  { owned: 1, costMult: '10' },
  { owned: 5, costMult: '50' },
  { owned: 25, costMult: '500' },
  { owned: 50, costMult: '5000' },
];

const GLOBAL_TIERS = [
  { requiredTotalOwned: 25, multiplier: 1.05, cost: '100000' },
  { requiredTotalOwned: 50, multiplier: 1.05, cost: '1000000' },
  { requiredTotalOwned: 100, multiplier: 1.1, cost: '50000000' },
  { requiredTotalOwned: 200, multiplier: 1.1, cost: '5000000000' },
  { requiredTotalOwned: 400, multiplier: 1.25, cost: '500000000000' },
];

const CLICK_CPS_TIERS = [
  { requiredClicks: 100, clickCpsShare: 0.01, cost: '50000' },
  { requiredClicks: 1_000, clickCpsShare: 0.01, cost: '5000000' },
  { requiredClicks: 10_000, clickCpsShare: 0.01, cost: '500000000' },
  { requiredClicks: 100_000, clickCpsShare: 0.01, cost: '50000000000' },
  { requiredClicks: 1_000_000, clickCpsShare: 0.01, cost: '5000000000000' },
];

function buildGeneratorEfficiencyUpgrades(generators) {
  return generators.flatMap((generator) =>
    GENERATOR_TIERS.map((tier, index) => ({
      id: `${generator.id}-efficiency-${index + 1}`,
      name: `${generator.label.toUpperCase()} EFFICIENCY ${ROMAN[index]}`,
      kind: 'generator',
      targetId: generator.id,
      targetLabel: generator.label,
      requiredOwned: tier.owned,
      multiplier: 2,
      cost: new Decimal(generator.baseCost).times(tier.costMult).toFixed(0),
    })),
  );
}

function buildGlobalUpgrades() {
  return GLOBAL_TIERS.map((tier, index) => ({
    id: `global-production-${index + 1}`,
    name: `GLOBAL PRODUCTION ${ROMAN[index]}`,
    kind: 'global',
    requiredTotalOwned: tier.requiredTotalOwned,
    multiplier: tier.multiplier,
    cost: tier.cost,
  }));
}

function buildClickCpsUpgrades() {
  return CLICK_CPS_TIERS.map((tier, index) => ({
    id: `cps-tap-${index + 1}`,
    name: `CPS TAP ${ROMAN[index]}`,
    kind: 'click_cps',
    requiredClicks: tier.requiredClicks,
    clickCpsShare: tier.clickCpsShare,
    cost: tier.cost,
  }));
}

function buildSynergyUpgrades(generators) {
  return generators.slice(0, -1).map((left, index) => {
    const right = generators[index + 1];
    return {
      id: `synergy-${left.id}-${right.id}`,
      name: `SYNERGY ${index + 1}↔${index + 2}`,
      kind: 'synergy',
      leftId: left.id,
      rightId: right.id,
      leftBonusPerRight: 0.05,
      rightBonusPerLeft: 0.001,
      requiredOwnedLeft: 15,
      requiredOwnedRight: 15,
      cost: new Decimal(right.baseCost).times(100).toFixed(0),
    };
  });
}

/** Genre-agnostic Cookie Clicker-style one-shot upgrades for the UPGRADE tab. */
export const META_UPGRADES = [
  ...buildGeneratorEfficiencyUpgrades(CLICKER_GENERATORS),
  ...buildGlobalUpgrades(),
  ...buildClickCpsUpgrades(),
  ...buildSynergyUpgrades(CLICKER_GENERATORS),
];
