import { setImmediate } from 'node:timers/promises';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '../src';

function buildTemporarySchema() {
  const builder = new SchemaBuilder({ plugins: [DirectivesPlugin, FederationPlugin] });
  builder.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }) });
  builder.toSubGraphSchema({});
  return new WeakRef(builder);
}

it('releases builders when their schemas are no longer referenced', async () => {
  // Obtain a full-GC hook without requiring every test invocation to use --expose-gc.
  setFlagsFromString('--expose_gc');
  const gc = runInNewContext('gc') as () => void;
  setFlagsFromString('--no-expose_gc');
  const builders = Array.from({ length: 3 }, buildTemporarySchema);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    // WeakRefs stay alive until the current job ends, including after deref().
    await setImmediate();
    gc();
    if (builders.every((ref) => ref.deref() === undefined)) {
      break;
    }
  }

  expect(builders.every((ref) => ref.deref() === undefined)).toBe(true);
});
