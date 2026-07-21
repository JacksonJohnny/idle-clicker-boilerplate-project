export const CLICK_UPGRADES = [
  { id: 'tap-power', label: 'Tap Power', baseCost: 15, baseValue: 1, growth: 1.15, type: 'click' },
  {
    id: 'auto-tap',
    label: 'Auto Tap',
    baseCost: 100,
    baseValue: 1,
    growth: 1.15,
    type: 'auto_tap',
    unlockAfter: 'tap-power',
  },
];

/** Seconds between each auto-tap wave. Each Auto Tap level adds 1 click per wave. */
export const AUTO_TAP_INTERVAL_SECONDS = 10;
