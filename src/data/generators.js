import { createGeneratorChain } from './generatorFactory.js';

export const CLICKER_GENERATORS = createGeneratorChain([
  { id: 'upgrade-1', label: 'Upgrade 1', baseCost: 100, baseValue: 1 },
  { id: 'upgrade-2', label: 'Upgrade 2', baseCost: 1100, baseValue: 8 },
  { id: 'upgrade-3', label: 'Upgrade 3', baseCost: 12000, baseValue: 47 },
  { id: 'upgrade-4', label: 'Upgrade 4', baseCost: 130000, baseValue: 260 },
  { id: 'upgrade-5', label: 'Upgrade 5', baseCost: 1400000, baseValue: 1400 },
  { id: 'upgrade-6', label: 'Upgrade 6', baseCost: 20000000, baseValue: 7800 },
  { id: 'upgrade-7', label: 'Upgrade 7', baseCost: 330000000, baseValue: 44000 },
  { id: 'upgrade-8', label: 'Upgrade 8', baseCost: 5100000000, baseValue: 260000 },
  { id: 'upgrade-9', label: 'Upgrade 9', baseCost: 75000000000, baseValue: 1600000 },
]);