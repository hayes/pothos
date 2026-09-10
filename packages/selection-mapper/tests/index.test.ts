import { expect, it } from 'vitest';
import * as index from '../src';

// The package is an implementation detail of the ORM plugins: it exports what they import, the
// two `Adapter` classes an adapter extends, and the entry points, and nothing else. Types are not
// visible here; this pins the runtime surface.
it('exports only what the plugins use', () => {
  expect(Object.keys(index).sort()).toEqual(
    [
      'Adapter',
      'TreeAdapter',
      'cacheKey',
      'deepEqual',
      'getLoaderMapping',
      'hasKeys',
      'planFromInfo',
      'queryFromInfo',
      'queryFromPlan',
      'rowPlanFromInfo',
      'selectedFieldNames',
      'setFieldMapping',
      'setLoaderMappings',
      'setRowMappings',
    ].sort(),
  );
});
