// Coverage gate: every option declared on `PrismaNextPluginOptions`
// must appear by name somewhere under `tests/`. Adding an option fails
// until you write a test that exercises it.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

const TESTS_DIR = fileURLToPath(new URL('.', import.meta.url));
const PLUGIN_OPTIONS_SRC = fileURLToPath(new URL('../src/types.ts', import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);

/**
 * Pull the property names off the `PrismaNextPluginOptions` interface
 * by reading `src/types.ts` and scanning the block between the
 * declaration header and the closing brace.
 */
function readPluginOptionKeys(): readonly string[] {
  const src = readFileSync(PLUGIN_OPTIONS_SRC, 'utf8');
  const start = src.indexOf('export interface PrismaNextPluginOptions');
  if (start < 0) {
    throw new Error('Could not find PrismaNextPluginOptions declaration in src/types.ts');
  }
  const openBrace = src.indexOf('{', start);
  if (openBrace < 0) {
    throw new Error('Could not find opening brace of PrismaNextPluginOptions');
  }
  // Brace-match to find the close.
  let depth = 0;
  let close = -1;
  for (let i = openBrace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) {
    throw new Error('Could not match closing brace for PrismaNextPluginOptions');
  }
  const body = src.slice(openBrace + 1, close);
  // Strip comments so doc text doesn't get matched as a property name.
  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // Match `readonly NAME?: ...;` and `NAME: ...;`.
  const re = /^\s*(?:readonly\s+)?(\w+)\??\s*:/gm;
  const keys = new Set<string>();
  for (const m of stripped.matchAll(re)) {
    keys.add(m[1]!);
  }
  return [...keys];
}

function listTestFiles(): readonly string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else if (full.endsWith('.test.ts') || full.endsWith('.test-d.ts')) {
        out.push(full);
      }
    }
  };
  walk(TESTS_DIR);
  return out;
}

/**
 * Read this file with the coverage-gate machinery itself stripped so
 * the gate doesn't satisfy itself with its own documentation /
 * comments. The per-option E2E describe block below stays — those
 * are real tests that exercise each option end-to-end.
 */
function readSelfWithoutGate(): string {
  const raw = readFileSync(THIS_FILE, 'utf8');
  // Drop the `plugin-options coverage gate` describe block (it
  // mentions every option name in its grep machinery, which would
  // self-satisfy the gate trivially).
  const start = raw.indexOf("describe('plugin-options coverage gate'");
  const end = raw.indexOf("describe('plugin-options end-to-end'");
  if (start < 0 || end < 0 || end <= start) {
    return raw;
  }
  return raw.slice(0, start) + raw.slice(end);
}

const REQUIRED_KEYS = new Set(['contract']);
const TEST_FILES = listTestFiles();
const TEST_FILE_CONTENTS = TEST_FILES.map((f) =>
  f === THIS_FILE ? readSelfWithoutGate() : readFileSync(f, 'utf8'),
).join('\n');

describe('plugin-options coverage gate', () => {
  // The list of optional plugin-option keys is derived at module load
  // so the test names enumerate them and a missing one shows up as a
  // specific failing test name, not a single bulk assertion.
  const pluginOptionKeys = readPluginOptionKeys().filter((k) => !REQUIRED_KEYS.has(k));

  it('discovers all PrismaNextPluginOptions keys', () => {
    expect(pluginOptionKeys.length).toBeGreaterThan(0);
  });

  for (const key of pluginOptionKeys) {
    it(`covers the "${key}" plugin option somewhere under tests/`, () => {
      // Word-boundary match so e.g. `default` doesn't accidentally
      // match `defaultConnectionSize`.
      const re = new RegExp(`\\b${key}\\b`);
      expect(
        re.test(TEST_FILE_CONTENTS),
        `No test under tests/ references the "${key}" plugin option. ` +
          'Every PrismaNextPluginOptions field must have at least one runtime test ' +
          'that constructs a builder with the option set and asserts behavior.',
      ).toBe(true);
    });
  }
});

// Per-option E2E gate. The greppy check above is a canary; this block
// spins up a builder per option and asserts a downstream effect.

let ctx: TestRuntimeContext;

beforeAll(async () => {
  ctx = await createTestRuntime();
});

afterAll(async () => {
  await ctx?.cleanup();
});

describe('plugin-options end-to-end', () => {
  it('defaultConnectionSize threads through t.prismaConnection', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: {
        contract: ctx.contract,
        defaultConnectionSize: 1,
      },
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({
          type: 'User',
          cursor: 'id',
          resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User)) as never,
        }),
      }),
    });
    // No `first:` arg — should default to 1 per the schema-wide option.
    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users { edges { node { id } } pageInfo { hasNextPage } } }'),
    });
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{ node: { id: string } }>;
        pageInfo: { hasNextPage: boolean };
      };
    };
    expect(data.users.edges).toHaveLength(1);
    expect(data.users.pageInfo.hasNextPage).toBe(true);
  });

  it('maxConnectionSize caps t.prismaConnection page size below requested first:', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: {
        contract: ctx.contract,
        maxConnectionSize: 1,
      },
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({
          type: 'User',
          cursor: 'id',
          resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User)) as never,
        }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users(first: 100) { edges { node { id } } } }'),
    });
    expect(result.errors).toBeUndefined();
    const data = result.data as { users: { edges: Array<{ node: { id: string } }> } };
    // 2 users seeded, first:100 requested, but maxConnectionSize:1 caps it.
    expect(data.users.edges).toHaveLength(1);
  });

  it('skipDeferredFragments option is wired through builder.options.prismaNext', async () => {
    // End-to-end behavior of `@defer` requires a graphql-js version with
    // the directive built in. The coverage-gate check above already
    // verifies the option name appears in tests/ (the auto-include
    // unit test wires it through `applySelectionToCollection`). Here we
    // just confirm the builder option type accepts and persists it.
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: {
        contract: ctx.contract,
        skipDeferredFragments: false,
      },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User).all()) as never,
        }),
      }),
    });
    const opts = (builder.options as { prismaNext?: { skipDeferredFragments?: boolean } })
      .prismaNext;
    expect(opts?.skipDeferredFragments).toBe(false);
    // And the schema still builds + queries.
    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users { id } }'),
    });
    expect(result.errors).toBeUndefined();
  });
});

describe('readPluginOptions — direct unit', () => {
  it('returns undefined when prismaNext is not set on builder.options', async () => {
    const { readPluginOptions } = await import('../src/utils/options');
    expect(readPluginOptions({ options: {} })).toBeUndefined();
  });

  it('returns the prismaNext slot when present', async () => {
    const { readPluginOptions } = await import('../src/utils/options');
    const contract = { models: {} } as never;
    const out = readPluginOptions({ options: { prismaNext: { contract } } });
    expect(out).toEqual({ contract });
  });
});
