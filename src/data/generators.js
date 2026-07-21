import { createGeneratorChain } from './generatorFactory.js';

/** Ids stay `upgrade-N` for save compatibility; labels are player-facing. */
export const CLICKER_GENERATORS = createGeneratorChain([
  { id: 'upgrade-1', label: 'Generator 1', baseCost: 100, baseValue: 1 },
  { id: 'upgrade-2', label: 'Generator 2', baseCost: 1100, baseValue: 8 },
  { id: 'upgrade-3', label: 'Generator 3', baseCost: 12000, baseValue: 47 },
  { id: 'upgrade-4', label: 'Generator 4', baseCost: 130000, baseValue: 260 },
  { id: 'upgrade-5', label: 'Generator 5', baseCost: 1400000, baseValue: 1400 },
  { id: 'upgrade-6', label: 'Generator 6', baseCost: 20000000, baseValue: 7800 },
  { id: 'upgrade-7', label: 'Generator 7', baseCost: 330000000, baseValue: 44000 },
  { id: 'upgrade-8', label: 'Generator 8', baseCost: 5100000000, baseValue: 260000 },
  { id: 'upgrade-9', label: 'Generator 9', baseCost: 75000000000, baseValue: 1600000 },
]);
