import SchemaBuilder from '@pothos/core';
import * as graphql from 'graphql';
import { describe, expect, it, vi } from 'vitest';

// Node's WASM service does not accept the browser-only wasmURL option.
vi.mock('esbuild-wasm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('esbuild-wasm')>();
  return { ...actual, initialize: () => actual.initialize({}) };
});

import { executeAndBuildSchema } from '../execution-engine';

const modules = { '@pothos/core': { default: SchemaBuilder }, graphql };

describe('playground module execution', () => {
  it('supports multiline imports, aliases, side effects, and strings containing module syntax', async () => {
    const result = await executeAndBuildSchema(
      `import {
        buildSchema as makeSchema,
        printSchema
      } from 'graphql';
      import '@pothos/plugin-relay';
      const description = "import X from 'nothing'; export const value = 1";
      export const schema = makeSchema('type Query { hello: String }');
      console.log(description, printSchema(schema));`,
      modules,
      { '@pothos/plugin-relay': {} },
    );
    expect(result.success).toBe(true);
    expect(result.schemaSDL).toContain('hello: String');
    expect(result.consoleLogs?.[0].args[0]).toBe(
      "import X from 'nothing'; export const value = 1",
    );
  });

  it('supports local default imports and named re-exports', async () => {
    const result = await executeAndBuildSchema(
      `import SchemaBuilder from '@pothos/core';
      const builder = new SchemaBuilder({});
      builder.queryType({ fields: t => ({ hello: t.string({ resolve: () => 'hello' }) }) });
      export const schema = builder.toSchema();
      export { buildSchema as createSchema } from 'graphql';`,
      modules,
    );
    expect(result.success).toBe(true);
    expect(result.schemaSDL).toContain('hello: String');
  });

  it('supports CDN CommonJS namespaces with values on their default export', async () => {
    const result = await executeAndBuildSchema(
      `import { buildSchema } from 'graphql';
      import helpers, { field as fieldName } from 'helpers';
      export const schema = buildSchema('type Query { ' + fieldName + ': ' + helpers.type + ' }');`,
      modules,
      { helpers: { default: { field: 'hello', type: 'String' }, field: undefined } },
    );
    expect(result.success).toBe(true);
    expect(result.schemaSDL).toContain('hello: String');
  });

  it('keeps logs and reports execution errors', async () => {
    const result = await executeAndBuildSchema("console.log('before'); throw new Error('bad schema')", modules);
    expect(result.success).toBe(false);
    expect(result.error).toBe('bad schema');
    expect(result.consoleLogs?.[0].args).toEqual(['before']);
  });
});
