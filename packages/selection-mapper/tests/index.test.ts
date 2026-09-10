import { expect, it } from 'vitest';
import * as index from '../src';

// The package is an implementation detail of the ORM plugins: it exports what they import, the
// `Adapter` contract, and the entry points, and nothing else. Types are not visible here; this
// pins the runtime surface.
it('exports only what the plugins use', () => {
  expect(Object.keys(index).sort()).toEqual(
    [
      'absorb',
      'accepts',
      'acceptsFrom',
      'accumulatorOf',
      'cacheKey',
      'conflictOf',
      'createNode',
      'deepEqual',
      'getLoaderMapping',
      'hasKeys',
      'planFromInfo',
      'queryFromInfo',
      'queryFromPlan',
      'relation',
      'rowPlanFromInfo',
      'selectedFieldNames',
      'setFieldMapping',
      'setLoaderMappings',
      'treeAccumulator',
    ].sort(),
  );
});
