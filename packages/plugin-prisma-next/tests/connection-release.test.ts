import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { OrderByItem, ParamRef } from '@prisma/orm-family-sql/relational-core/ast';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import {
  applyCursorPagination,
  buildConnectionPage,
  type CursorInput,
  decodeCursor,
  encodeCursor,
} from '../src/utils/cursors';
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

function builder() {
  const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract },
  });
  b.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
  return b;
}

it('does not load root page rows for a totalCount-only selection', async () => {
  const b = builder();
  b.queryType({
    fields: (t) => ({
      users: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        totalCount: true,
        resolve: () => ctx.ormClient.User,
      }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, async () =>
    execute({
      schema: b.toSchema(),
      contextValue: {},
      document: parse('{ users { totalCount } }'),
    }),
  );
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ users: { totalCount: 2 } });
  expect(captures).toHaveLength(1);
  expect(captures[0].sql).toMatch(/count\(/i);
});

it('does not start a helper count until it is read, and caches the promise', async () => {
  const count = vi.fn(async () => 17);
  const helper = prismaConnectionHelpers(builder(), 'User', { cursor: 'id', totalCount: count });
  const result = await helper.applyPagination(ctx.ormClient.User, {}, undefined, {});
  await Promise.resolve();
  expect(count).not.toHaveBeenCalled();
  const first = result.totalCountPromise;
  expect(result.totalCountPromise).toBe(first);
  expect(await first).toBe(17);
  expect(count).toHaveBeenCalledTimes(1);
});

it('does not invoke a helper count when only edges are selected', async () => {
  const count = vi.fn(async () => 17);
  const b = builder();
  const helper = prismaConnectionHelpers(b, 'User', { cursor: 'id', totalCount: count });
  b.queryType({
    fields: (t) => ({
      users: t.connection(
        {
          type: helper.ref,
          resolve: async (_parent, args, context, info) => {
            const page = await helper.applyPagination(ctx.ormClient.User, args, info, context);
            const total = await page.totalCountPromise;
            return page.wrap(await page.collection.all(), total);
          },
        },
        helper.connectionOptions({}),
      ),
    }),
  });
  const result = await execute({
    schema: b.toSchema(),
    contextValue: {},
    document: parse('{ users { edges { node { id } } } }'),
  });
  expect(result.errors).toBeUndefined();
  expect(count).not.toHaveBeenCalled();
});

it.each([
  'orderBy',
  'limit',
  'offset',
  'cursor',
] as const)('rejects a base with %s before executing SQL', async (method) => {
  const bases = {
    orderBy: ctx.ormClient.User.orderBy((u) => u.id.desc()),
    limit: ctx.ormClient.User.limit(1),
    offset: ctx.ormClient.User.offset(1),
    cursor: ctx.ormClient.User.orderBy((u) => u.id.asc()).cursor({ id: 'u-alice' }),
  };
  const base = bases[method];
  const captures: CapturedExecution[] = [];
  await withCapture(captures, () => {
    expect(() => applyCursorPagination(base as never, 'id', { first: 1 })).toThrow(
      method === 'orderBy' ? /must match a prefix/ : /unpaginated Collection/,
    );
    return Promise.resolve();
  });
  expect(captures).toHaveLength(0);
});

it.each([
  [
    'descending',
    [{ field: 'id', direction: 'desc' }],
    ['p-hello', 'p-draft1', 'p-bob1', 'p-bob-draft'],
  ],
  [
    'mixed',
    [
      { field: 'published', direction: 'desc' },
      { field: 'id', direction: 'asc' },
    ],
    ['p-bob1', 'p-hello', 'p-bob-draft', 'p-draft1'],
  ],
] as const)('traverses every row forwards and backwards with %s ordering', async (_name, cursor, expected) => {
  const read = async (args: { first?: number; last?: number; after?: string; before?: string }) => {
    const pagination = applyCursorPagination(
      ctx.ormClient.Post as never,
      cursor as CursorInput,
      args,
    );
    const rows = await (
      pagination.collection as unknown as { all(): Promise<Record<string, unknown>[]> }
    ).all();
    return buildConnectionPage(rows as Record<string, unknown>[], pagination);
  };
  const ids: unknown[] = [];
  const cursors: string[] = [];
  let after: string | undefined;
  for (let i = 0; i < expected.length; i += 1) {
    const page = await read({ first: 1, after });
    expect(page.edges).toHaveLength(1);
    ids.push(page.edges[0].node.id);
    after = page.pageInfo.endCursor!;
    cursors.push(after);
  }
  expect(ids).toEqual(expected);
  expect((await read({ first: 1, after })).edges).toHaveLength(0);
  const reverse: unknown[] = [];
  let before: string | undefined;
  for (let i = 0; i < expected.length; i += 1) {
    const page = await read({ last: 1, before });
    reverse.unshift(page.edges[0].node.id);
    before = page.pageInfo.startCursor!;
  }
  expect(reverse).toEqual(expected);
  expect(
    (await read({ first: 4, after: cursors[0], before: cursors[3] })).edges.map(
      (edge) => edge.node.id,
    ),
  ).toEqual(expected.slice(1, 3));
  expect((await read({ first: 4, before: cursors[2] })).edges.map((edge) => edge.node.id)).toEqual(
    expected.slice(0, 2),
  );
  expect((await read({ last: 4, after: cursors[1] })).edges.map((edge) => edge.node.id)).toEqual(
    expected.slice(2),
  );
});

it('restores custom scalar values with an explicit cursor codec', () => {
  class PreciseValue {
    constructor(readonly text: string) {}
    toString() {
      return this.text;
    }
  }
  const cursor = [
    {
      field: 'timestamp',
      codec: {
        encode: (value: PreciseValue) => value.text,
        decode: (value: string) => new PreciseValue(value),
      },
    },
    'id',
  ];
  const timestamp = new PreciseValue('2026-09-10T01:02:03.123456789Z');
  const encoded = encodeCursor(cursor, { timestamp, id: BigInt('9007199254740993') });
  const decoded = decodeCursor(cursor, encoded);
  expect(decoded.timestamp).toBeInstanceOf(PreciseValue);
  expect(String(decoded.timestamp)).toBe(timestamp.text);
  expect(decoded.id).toBe(BigInt('9007199254740993'));
});

it('requires a complete unique key instead of losing tied rows between pages', () => {
  const b = builder();
  expect(() => prismaConnectionHelpers(b, 'User', { cursor: 'firstName' })).toThrow(
    /unique tie-breaker/,
  );
  expect(() => prismaConnectionHelpers(b, 'User', { cursor: ['firstName', 'id'] })).not.toThrow();
  expect(() => prismaConnectionHelpers(b, 'User', { cursor: 'email' })).not.toThrow();
});

it('rejects duplicate or empty cursor declarations', () => {
  const b = builder();
  expect(() => prismaConnectionHelpers(b, 'User', { cursor: ['id', 'id'] })).toThrow(
    /distinct columns/,
  );
  expect(() => prismaConnectionHelpers(b, 'User', { cursor: [] as never })).toThrow(
    /cannot be empty/,
  );
});

it('reports malformed custom cursor values without leaking the decoder error or payload', () => {
  const secret = 'private-invalid-boundary';
  const cursor = [
    {
      field: 'id',
      codec: {
        encode: (value: string) => value,
        decode: (value: string): string => {
          throw new Error(`Invalid secret: ${value}`);
        },
      },
    },
  ];
  expect(() => decodeCursor(cursor, encodeCursor(['id'], { id: secret }))).toThrow(
    'Invalid cursor value for id.',
  );
  expect(() => decodeCursor(cursor, encodeCursor(['id'], { id: 42 }))).toThrow(
    'Invalid cursor value for id.',
  );
});

it('accepts matching preordered Collections across forward pages without duplicate order columns', async () => {
  const base = ctx.ormClient.Post.orderBy((p) => p.id.asc());
  const first = applyCursorPagination(base as never, 'id', { first: 2 });
  const firstPage = buildConnectionPage(
    await (first.collection as unknown as typeof ctx.ormClient.Post).all(),
    first,
  );
  expect(firstPage.edges.map(({ node }) => node.id)).toEqual(['p-bob-draft', 'p-bob1']);
  const second = applyCursorPagination(base as never, 'id', {
    first: 2,
    after: firstPage.pageInfo.endCursor!,
  });
  expect(
    buildConnectionPage(
      await (second.collection as unknown as typeof ctx.ormClient.Post).all(),
      second,
    ).edges.map(({ node }) => node.id),
  ).toEqual(['p-draft1', 'p-hello']);
});

it('extends a matching order prefix with the unique cursor tie-breaker', async () => {
  const cursor: CursorInput = [{ field: 'published', direction: 'desc' }, 'id'];
  const base = ctx.ormClient.Post.orderBy((p) => p.published.desc());
  const pagination = applyCursorPagination(base as never, cursor, { first: 4 });
  const page = buildConnectionPage(
    await (pagination.collection as unknown as typeof ctx.ormClient.Post).all(),
    pagination,
  );
  expect(page.edges.map(({ node }) => node.id)).toEqual([
    'p-bob1',
    'p-hello',
    'p-bob-draft',
    'p-draft1',
  ]);
});

it('accepts reversed preordering for backward pages, preserving bounded results', async () => {
  const base = ctx.ormClient.Post.orderBy((p) => p.id.desc());
  const pagination = applyCursorPagination(base as never, 'id', {
    last: 2,
    before: encodeCursor('id', { id: 'p-hello' }),
  });
  expect(
    buildConnectionPage(
      await (pagination.collection as unknown as typeof ctx.ormClient.Post).all(),
      pagination,
    ).edges.map(({ node }) => node.id),
  ).toEqual(['p-bob1', 'p-draft1']);
});

it.each([
  [
    'expression with bigint',
    () => ctx.ormClient.Post.orderBy(() => OrderByItem.asc(new ParamRef(BigInt(1)))),
    { first: 2 },
  ],
  ['incompatible column', () => ctx.ormClient.Post.orderBy((p) => p.title.asc()), { first: 2 }],
  [
    'extra order columns',
    () => ctx.ormClient.Post.orderBy([(p) => p.id.asc(), (p) => p.title.asc()]),
    { first: 2 },
  ],
  ['backward direction mismatch', () => ctx.ormClient.Post.orderBy((p) => p.id.asc()), { last: 2 }],
] as const)('rejects %s instead of silently changing the requested order', async (_label, getBase, args) => {
  const captures: CapturedExecution[] = [];
  await withCapture(captures, () => {
    expect(() => applyCursorPagination(getBase() as never, 'id', args)).toThrow(
      /must match a prefix/,
    );
    return Promise.resolve();
  });
  expect(captures).toHaveLength(0);
});

it('validates incompatible ordering even when only totalCount is selected', async () => {
  const b = builder();
  b.queryType({
    fields: (t) => ({
      users: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        totalCount: true,
        resolve: () => ctx.ormClient.User.orderBy((u) => u.id.desc()),
      }),
    }),
  });
  const captures: CapturedExecution[] = [];
  const result = await withCapture(captures, () =>
    Promise.resolve(
      execute({
        schema: b.toSchema(),
        contextValue: {},
        document: parse('{ users(first: 1) { totalCount } }'),
      }),
    ),
  );
  expect(result.errors?.[0].message).toMatch(/must match a prefix/);
  expect(captures).toHaveLength(0);
});
