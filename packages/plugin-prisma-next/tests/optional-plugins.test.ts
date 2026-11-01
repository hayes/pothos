// Deliberately imports neither @pothos/plugin-relay nor @pothos/plugin-with-input: both patch the
// field builder prototypes when imported, and vitest isolates each test file's modules.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import SchemaBuilder, { PothosSchemaError } from '@pothos/core';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { sampleContract } from './fixtures/runtime';

function createBuilder() {
  return new SchemaBuilder<{ PrismaNextContract: typeof sampleContract }>({
    plugins: [prismaNextPlugin],
    prismaNext: { client: { context: { contract: sampleContract }, orm: {} } as never },
  });
}

function buildError(define: (builder: ReturnType<typeof createBuilder>) => void) {
  const builder = createBuilder();
  try {
    define(builder);
    builder.toSchema();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('missing optional plugins', () => {
  it('names the relay plugin for relatedConnection', () => {
    const error = buildError((builder) => {
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.prismaObject('User', {
        fields: (t) => ({
          posts: (
            t as unknown as { relatedConnection: (...args: unknown[]) => never }
          ).relatedConnection('posts', { cursor: 'id' }),
        }),
      });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    });
    expect(error).toBeInstanceOf(PothosSchemaError);
    expect((error as Error).message).toBe(
      't.relatedConnection requires @pothos/plugin-relay to be loaded.',
    );
  });

  it('names the relay plugin for prismaNode', () => {
    const error = buildError((builder) => {
      (builder as unknown as { prismaNode: (model: string, options: object) => never }).prismaNode(
        'User',
        { id: { field: 'id' }, fields: () => ({}) },
      );
    });
    expect(error).toBeInstanceOf(PothosSchemaError);
    expect((error as Error).message).toBe(
      'builder.prismaNode requires @pothos/plugin-relay to be loaded.',
    );
  });

  it('names the relay plugin for prismaConnection', () => {
    const error = buildError((builder) => {
      builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.queryType({
        fields: (t) => ({
          users: (
            t as unknown as { prismaConnection: (options: object) => never }
          ).prismaConnection({ type: 'User', cursor: 'id', resolve: () => null }),
        }),
      });
    });
    expect(error).toBeInstanceOf(PothosSchemaError);
    expect((error as Error).message).toBe(
      't.prismaConnection requires @pothos/plugin-relay to be loaded.',
    );
  });

  it('names the with-input plugin for prismaFieldWithInput', () => {
    const error = buildError((builder) => {
      builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
      builder.mutationType({
        fields: (t) => ({
          user: (
            t as unknown as { prismaFieldWithInput: (options: object) => never }
          ).prismaFieldWithInput({ type: 'User', input: {}, resolve: () => null }),
        }),
      });
    });
    expect(error).toBeInstanceOf(PothosSchemaError);
    expect((error as Error).message).toBe(
      't.prismaFieldWithInput requires @pothos/plugin-with-input to be loaded.',
    );
  });
});

describe('optional plugins', () => {
  it('imports the built package without plugin-relay or plugin-with-input', () => {
    // CI builds packages before their tests; the CommonJS entry point runs in its own process.
    const entry = fileURLToPath(new URL('../lib/index.js', import.meta.url));
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
        const Module = require('node:module');
        const load = Module._load;
        Module._load = function (name, ...args) {
          if (name === '@pothos/plugin-relay' || name === '@pothos/plugin-with-input') {
            throw new Error('Optional plugin imported: ' + name);
          }
          return load.call(this, name, ...args);
        };
        const plugin = require(process.argv[1]);
        if (plugin.default !== 'prismaNext') throw new Error('Missing plugin export');
        process.stdout.write('ok');
        `,
        entry,
      ],
      { encoding: 'utf8' },
    );
    expect(output).toBe('ok');
  });
});
