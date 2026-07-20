import { describe, expect, it } from 'vitest';
import { createGenerator, createGeneratorChain, DEFAULT_GENERATOR_GROWTH, DEFAULT_GENERATOR_MILESTONES } from './generatorFactory.js';

describe('generatorFactory', () => {
  it('applies generator defaults without sharing the milestone array', () => {
    const first = createGenerator({ id: 'first', label: 'First', baseCost: 10, baseValue: 1 });
    const second = createGenerator({ id: 'second', label: 'Second', baseCost: 20, baseValue: 2 });

    expect(first).toMatchObject({ type: 'auto', growth: DEFAULT_GENERATOR_GROWTH });
    expect(first.milestones).toEqual(DEFAULT_GENERATOR_MILESTONES);
    expect(first.milestones).not.toBe(second.milestones);
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
      milestones: [5, 15],
    });

    expect(generator.growth).toBe(1.2);
    expect(generator.milestones).toEqual([5, 15]);
  });
});