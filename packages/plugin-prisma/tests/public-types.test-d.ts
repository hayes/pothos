import type { Mappings } from '@pothos/selection-mapper';
import { expectTypeOf, it } from 'vitest';
import type { LoaderMappings } from '../src';

// `LoaderMappings` was public before the planner moved to @pothos/selection-mapper; it stays as a
// deprecated alias of the shared type so consumers keep compiling.
it('keeps LoaderMappings as an alias of the shared Mappings type', () => {
  expectTypeOf<LoaderMappings>().toEqualTypeOf<Mappings>();
});
