export const DEFAULT_GENERATOR_GROWTH = 1.15;

export function createGenerator(definition, unlockAfter) {
  return {
    ...definition,
    growth: definition.growth ?? DEFAULT_GENERATOR_GROWTH,
    type: 'auto',
    ...(unlockAfter ? { unlockAfter } : {}),
  };
}

export function createGeneratorChain(definitions) {
  return definitions.map((definition, index) => createGenerator(definition, definitions[index - 1]?.id));
}
