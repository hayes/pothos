import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { OrderByItem } from '@prisma/orm-family-sql/relational-core/ast';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import {
  applyCursorPagination,
  buildConnectionPage,
  type CursorInput,
  decodeCursor,
  encodeCursor,
  validateCursor,
} from '../src/utils/cursors';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;
const rows = [
  { id: 'n-1', score: null, authorId: 'u-alice' },
  { id: 'n-2', score: 2, authorId: 'u-alice' },
  { id: 'n-3', score: 1, authorId: 'u-alice' },
  { id: 'n-4', score: null, authorId: 'u-bob' },
  { id: 'n-5', score: 2, authorId: 'u-bob' },
  { id: 'n-6', score: 1, authorId: 'u-bob' },
];

beforeAll(async () => {
  ctx = await createTestRuntime();
  for (const row of rows) {
    await ctx.ormClient.Post.create({
      ...row,
      title: 'nullable-sort',
      content: '',
      published: 1,
      createdAt: new Date('2026-01-01'),
    });
  }
});
afterAll(async () => ctx?.cleanup());

function sorted(direction: 'asc' | 'desc', nulls: 'first' | 'last') {
  return [...rows].sort((a, b) => {
    if (a.score === null || b.score === null) {
      if (a.score !== b.score) {
        return (a.score === null ? -1 : 1) * (nulls === 'first' ? 1 : -1);
      }
    } else if (a.score !== b.score) {
      return (a.score - b.score) * (direction === 'asc' ? 1 : -1);
    }
    return a.id.localeCompare(b.id);
  });
}

for (const direction of ['asc', 'desc'] as const) {
  for (const nulls of ['first', 'last'] as const) {
    describe(`${direction}, nulls ${nulls}`, () => {
      const cursor: CursorInput = [{ field: 'score', direction, nulls }, 'id'];
      it('pages every bounded interval forward and backward without losing nulls or ties', async () => {
        const expected = sorted(direction, nulls);
        // Include open ends, null boundaries, non-null boundaries, and both-bound ranges.
        for (let after = -1; after < expected.length; after += 1) {
          for (let before = after + 1; before <= expected.length; before += 1) {
            const bounded = expected.slice(after + 1, before);
            for (const backward of [false, true]) {
              const pagination = applyCursorPagination(
                ctx.ormClient.Post.where({ title: 'nullable-sort' }) as never,
                cursor,
                {
                  ...(after >= 0 ? { after: encodeCursor(cursor, expected[after]) } : {}),
                  ...(before < expected.length
                    ? { before: encodeCursor(cursor, expected[before]) }
                    : {}),
                  ...(backward ? { last: 2 } : { first: 2 }),
                },
              );
              const page = buildConnectionPage(
                await (pagination.collection as unknown as typeof ctx.ormClient.Post).all(),
                pagination,
              );
              expect(page.edges.map(({ node }) => node.id)).toEqual(
                (backward ? bounded.slice(-2) : bounded.slice(0, 2)).map(({ id }) => id),
              );
              expect(backward ? page.pageInfo.hasPreviousPage : page.pageInfo.hasNextPage).toBe(
                bounded.length > 2,
              );
            }
          }
        }
      });

      it('preserves null ordering and page limits independently for each included parent', async () => {
        const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
          plugins: [RelayPlugin, prismaNextPlugin],
          relay: { nodesOnConnection: true },
          prismaNext: { contract: ctx.contract },
        });
        b.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
        b.prismaObject('User', {
          fields: (t) => ({
            id: t.exposeID('id'),
            posts: t.relatedConnection('posts', {
              cursor: [{ field: 'score', direction, nulls }, 'id'],
              where: { title: 'nullable-sort' },
              totalCount: true,
            }),
          }),
        });
        b.queryType({
          fields: (t) => ({
            users: t.prismaField({ type: ['User'], resolve: () => ctx.ormClient.User }),
          }),
        });
        for (const backward of [false, true]) {
          const result = await execute({
            schema: b.toSchema(),
            contextValue: {},
            document: parse(
              `{ users { id posts(${backward ? 'last' : 'first'}: 2) { nodes { id } totalCount } } }`,
            ),
          });
          expect(result.errors).toBeUndefined();
          const data = result.data as {
            users: { id: string; posts: { nodes: { id: string }[]; totalCount: number } }[];
          };
          for (const user of data.users) {
            const expected = sorted(direction, nulls).filter((row) => row.authorId === user.id);
            expect(user.posts.nodes.map(({ id }) => id)).toEqual(
              (backward ? expected.slice(-2) : expected.slice(0, 2)).map(({ id }) => id),
            );
            expect(user.posts.totalCount).toBe(3);
          }
        }
      });
    });
  }
}

it('defaults nullable fields to nulls last through root connections and helpers', async () => {
  const b = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: { nodesOnConnection: true },
    prismaNext: { contract: ctx.contract },
  });
  b.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
  b.queryType({
    fields: (t) => ({
      posts: t.prismaConnection({
        type: 'Post',
        cursor: ['score', 'id'],
        resolve: () => ctx.ormClient.Post.where({ title: 'nullable-sort' }),
      }),
    }),
  });
  const result = await execute({
    schema: b.toSchema(),
    contextValue: {},
    document: parse('{ posts(first: 6) { nodes { id } } }'),
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    posts: { nodes: sorted('asc', 'last').map(({ id }) => ({ id })) },
  });
  const helpers = prismaConnectionHelpers(b, 'Post', { cursor: ['score', 'id'] });
  const page = await helpers.applyPagination(
    ctx.ormClient.Post.where({ title: 'nullable-sort' }),
    { first: 6 },
    undefined,
    {},
  );
  expect((await page.collection.all()).map(({ id }) => id)).toEqual(
    sorted('asc', 'last').map(({ id }) => id),
  );
});

it('requires a complete non-null unique key even when a nullable field is unique', () => {
  const contract = structuredClone(ctx.contract);
  const table = contract.storage.namespaces.__unbound__.entries.table.post;
  Object.assign(table, { uniques: [{ columns: ['score'] }] });
  expect(() => validateCursor(contract, 'Post', 'score')).toThrow(/non-null primary or unique key/);
  expect(() => validateCursor(contract, 'Post', ['score', 'id'])).not.toThrow();
});

it('bypasses application codecs for null cursor values', () => {
  const codec = { encode: vi.fn((value: number) => String(value)), decode: vi.fn(Number) };
  const cursor = [{ field: 'score', codec }, 'id'];
  expect(decodeCursor(cursor, encodeCursor(cursor, { score: null, id: 'n-1' }))).toEqual({
    score: null,
    id: 'n-1',
  });
  expect(codec.encode).not.toHaveBeenCalled();
  expect(codec.decode).not.toHaveBeenCalled();
});

it('accepts a complete explicit nullable order without appending duplicate entries', async () => {
  const base = ctx.ormClient.Post.where({ title: 'nullable-sort' }).orderBy([
    (p) => OrderByItem.asc(p.score.isNull()),
    (p) => p.score.asc(),
    (p) => p.id.asc(),
  ]);
  const pagination = applyCursorPagination(
    base as never,
    [{ field: 'score', nulls: 'last' }, 'id'],
    { first: 3 },
  );
  expect(
    buildConnectionPage(
      await (pagination.collection as unknown as typeof ctx.ormClient.Post).all(),
      pagination,
    ).edges.map(({ node }) => node.id),
  ).toEqual(['n-3', 'n-6', 'n-2']);
});
