import { expect, it } from 'vitest';
import * as index from '../src';

// The package is an implementation detail of the ORM plugins: it exports what they import, the
// two `Adapter` classes an adapter extends, and `Plan`, which carries the two entry points as
// statics, and nothing else. Types are not visible here; this pins the runtime surface.
it('exports only what the plugins use', () => {
  expect(Object.keys(index).sort()).toEqual(
    [
      'Adapter',
      'Plan',
      'NodeAdapter',
      'cacheKey',
      'deepEqual',
      'getLoaderMapping',
      'selectedFieldNames',
      'setFieldMapping',
      'setLoaderMappings',
      'setRowFieldMapping',
      'setRowMappings',
    ].sort(),
  );
});
