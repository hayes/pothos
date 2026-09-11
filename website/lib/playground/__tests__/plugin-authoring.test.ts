import SchemaBuilder from '@pothos/core';
import * as graphql from 'graphql';
import { describe, expect, it, vi } from 'vitest';

vi.mock('esbuild-wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('esbuild-wasm')>();
  return { ...actual, initialize: () => actual.initialize({}) };
});

import { executeAndBuildSchema } from '../execution-engine';
import { pothosModule } from '../pothos-bundle';

const modules = { '@pothos/core': pothosModule, graphql };
const source = (name: string, message: string) => `
import SchemaBuilder, { BasePlugin, mapInputFields, createInputValueMapper } from '@pothos/core';
if (typeof mapInputFields !== 'function' || typeof createInputValueMapper !== 'function') throw Error('missing public helpers');
class Plugin extends BasePlugin {
  wrapResolve() { return () => '${message}'; }
}
SchemaBuilder.registerPlugin('${name}', Plugin);
const builder = new SchemaBuilder({ plugins: ['${name}'] });
builder.queryType({ fields: t => ({ hello: t.string({ resolve: () => 'original' }) }) });
export const schema = builder.toSchema();`;

describe('plugin authoring in the playground', () => {
  it('exposes the public plugin class and input mapping helpers', async () => {
    const result = await executeAndBuildSchema(source('playgroundPublicPlugin', 'first'), modules);
    expect(result.success, result.error).toBe(true);
  });

  it('rebuilds edited plugins and restores the registration safeguard', async () => {
    const previous = SchemaBuilder.allowPluginReRegistration;
    SchemaBuilder.allowPluginReRegistration = false;
    try {
      const first = await executeAndBuildSchema(source('playgroundEditedPlugin', 'first'), modules);
      expect(first.success, first.error).toBe(true);
      const edited = await executeAndBuildSchema(
        source('playgroundEditedPlugin', 'edited'),
        modules,
      );
      expect(edited.success, edited.error).toBe(true);
      expect(await graphql.graphql({ schema: edited.schema!, source: '{ hello }' })).toEqual({
        data: { hello: 'edited' },
      });
      expect(SchemaBuilder.allowPluginReRegistration).toBe(false);
      const failed = await executeAndBuildSchema("throw new Error('failed build')", modules);
      expect(failed.success).toBe(false);
      expect(SchemaBuilder.allowPluginReRegistration).toBe(false);
      SchemaBuilder.allowPluginReRegistration = true;
      await executeAndBuildSchema("throw new Error('failed build')", modules);
      expect(SchemaBuilder.allowPluginReRegistration).toBe(true);
    } finally {
      SchemaBuilder.allowPluginReRegistration = previous;
    }
  });
});
