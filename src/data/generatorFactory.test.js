import { describe, expect, it } from 'vitest';
import { createGenerator, createGeneratorChain, DEFAULT_GENERATOR_GROWTH } from './generatorFactory.js';

describe('generatorFactory', () => {
  it('applies generator defaults', () => {
    const generator = createGenerator({ id: 'first', label: 'First', baseCost: 10, baseValue: 1 });

    expect(generator).toMatchObject({ type: 'auto', growth: DEFAULT_GENERATOR_GROWTH });
    expect(generator.milestones).toBeUndefined();
  });

  it('links a generator chain in catalog order', () => {
    const chain = createGeneratorChain([
      { id: 'a', label: 'A', baseCost: 10, baseValue: 1 },
      { id: 'b', label: 'B', baseCost: 20, baseValue: 2 },
      { id: 'c', label: 'C', baseCost: 30, baseValue: 3 },
    ]);

    expect(chain[0].unlockAfter).toBeUndefined();
    expect(chain[1].unlockAfter).toBe('a');
    expect(chain[2].unlockAfter).toBe('b');
  });

  it('preserves explicit balancing overrides', () => {
    const generator = createGenerator({
      id: 'custom',
      label: 'Custom',
      baseCost: 50,
      baseValue: 5,
      growth: 1.2,
    });

    expect(generator.growth).toBe(1.2);
  });
});
