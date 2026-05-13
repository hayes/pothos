import SchemaBuilder from '@pothos/core';
import relayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { pathKey } from '../src/utils/node-batch';
import {
  type CapturedExecution,
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;

beforeAll(async () => {
  ctx = await createTestRuntime();
});

afterAll(async () => {
  await ctx?.cleanup();
});

function encodeNodeId(typeName: string, raw: string): string {
  return Buffer.from(`${typeName}:${raw}`).toString('base64');
}

function buildSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [prismaNextPlugin, relayPlugin],
    relay: { clientMutationId: 'omit', cursorType: 'String' },
    prismaNext: { contract: ctx.contract },
  });

  builder.prismaNode('User', {
    id: { field: 'id' },
    collection: ctx.ormClient.User,
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
    }),
  });

  builder.prismaNode('Post', {
    id: { field: 'id' },
    collection: ctx.ormClient.Post,
    fields: (t) => ({
      title: t.exposeString('title'),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      n: t.int({ nullable: true, resolve: () => null }),
    }),
  });
  return builder.toSchema();
}

describe('pathKey — compatibility key derivation', () => {
  it('drops numeric segments, keeps string segments', () => {
    expect(
      pathKey({
        prev: {
          prev: { prev: undefined, key: 'users', typename: 'Query' },
          key: 0,
          typename: 'User',
        },
        key: 'posts',
        typename: 'User',
      }),
    ).toBe('users.posts');
  });

  it('returns the leaf key alone for a root field', () => {
    expect(pathKey({ prev: undefined, key: 'node', typename: 'Query' })).toBe('node');
  });

  it('treats aliases as distinct keys', () => {
    expect(pathKey({ prev: undefined, key: 'a', typename: 'Query' })).toBe('a');
    expect(pathKey({ prev: undefined, key: 'b', typename: 'Query' })).toBe('b');
  });
});

describe('prismaNode batching — aliases split into separate batches', () => {
  it('two aliased node(id:) calls → two SELECT statements on user table', async () => {
    const schema = buildSchema();
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      execute({
        schema,
        contextValue: {},
        document: parse(`{
          a: node(id: "${encodeNodeId('User', 'u-alice')}") { ... on User { firstName } }
          b: node(id: "${encodeNodeId('User', 'u-bob')}") { ... on User { firstName } }
        }`),
      }),
    );
    expect(result.errors).toBeUndefined();
    // Aliases create distinct paths — `Query.a` vs `Query.b` — so two
    // separate SELECTs hit the user table.
    const userSelects = captures.filter((c) => /from\s+"?user"?/i.test(c.sql));
    expect(userSelects).toHaveLength(2);
    expect(result.data).toEqual({
      a: { firstName: 'Alice' },
      b: { firstName: 'Bob' },
    });
  });
});

describe('prismaNode batching — list-element node lookups coalesce', () => {
  it('nodes(ids: [...]) → one SELECT with all ids in the IN-list (same pathKey)', async () => {
    const schema = buildSchema();
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      execute({
        schema,
        contextValue: {},
        document: parse(`{
          nodes(ids: [
            "${encodeNodeId('User', 'u-alice')}",
            "${encodeNodeId('User', 'u-bob')}"
          ]) { ... on User { firstName } }
        }`),
      }),
    );
    expect(result.errors).toBeUndefined();
    const userSelects = captures.filter((c) => /from\s+"?user"?/i.test(c.sql));
    expect(userSelects).toHaveLength(1);
    // Both ids appear in the params of the single SELECT.
    const allParams = userSelects.flatMap((c) => c.params);
    expect(allParams).toContain('u-alice');
    expect(allParams).toContain('u-bob');
    expect(result.data).toEqual({
      nodes: [{ firstName: 'Alice' }, { firstName: 'Bob' }],
    });
  });
});

describe('prismaNode batching — different types stay separate', () => {
  it('User and Post node lookups in one query → SELECT on each table', async () => {
    const schema = buildSchema();
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      execute({
        schema,
        contextValue: {},
        document: parse(`{
          u: node(id: "${encodeNodeId('User', 'u-alice')}") { ... on User { firstName } }
          p: node(id: "${encodeNodeId('Post', 'p-hello')}") { ... on Post { title } }
        }`),
      }),
    );
    expect(result.errors).toBeUndefined();
    const tables = captures
      .map((c) => /from\s+"?(user|post)"?/i.exec(c.sql)?.[1]?.toLowerCase())
      .filter(Boolean);
    expect(tables.sort()).toEqual(['post', 'user']);
  });
});

describe('prismaNode batching — id fan-out by id-field equality', () => {
  it('returns null for an id the SELECT did not return a row for', async () => {
    const schema = buildSchema();
    const result = await execute({
      schema,
      contextValue: {},
      document: parse(`{
        nodes(ids: [
          "${encodeNodeId('User', 'u-alice')}",
          "${encodeNodeId('User', 'u-missing')}"
        ]) { ... on User { firstName } }
      }`),
    });
    expect(result.errors).toBeUndefined();
    const data = result.data as { nodes: Array<{ firstName: string } | null> };
    expect(data.nodes[0]).not.toBeNull();
    expect(data.nodes[1]).toBeNull();
  });
});

describe('prismaNode — missing collection throws at schema-build time', () => {
  it('omitting collection surfaces a clear PothosSchemaError', () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, relayPlugin],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    });
    expect(() =>
      // @ts-expect-error — `collection` is required by the public type.
      builder.prismaNode('User', {
        id: { field: 'id' },
        fields: (t) => ({ firstName: t.exposeString('firstName') }),
      }),
    ).toThrow(/requires a `collection` option/);
  });
});

describe('prismaNode — collection callback form receives ctx', () => {
  it('callback collection: (ctx) => orm runs once per batch with the request ctx', async () => {
    const seenCtx: unknown[] = [];
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      Context: { tag: string };
    }>({
      plugins: [prismaNextPlugin, relayPlugin],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaNode('User', {
      id: { field: 'id' },
      collection: (reqCtx) => {
        seenCtx.push(reqCtx);
        return ctx.ormClient.User;
      },
      fields: (t) => ({ firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({ n: t.int({ nullable: true, resolve: () => null }) }),
    });
    const schema = builder.toSchema();
    const result = await execute({
      schema,
      contextValue: { tag: 'req-1' },
      document: parse(`{
        node(id: "${encodeNodeId('User', 'u-alice')}") { ... on User { firstName } }
      }`),
    });
    expect(result.errors).toBeUndefined();
    expect(seenCtx).toHaveLength(1);
    expect((seenCtx[0] as { tag: string }).tag).toBe('req-1');
  });
});
