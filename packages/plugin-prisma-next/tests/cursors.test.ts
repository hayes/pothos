import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import { detailOf, unexpected } from './fixtures/errors';
import { createBuilder, run, useCollisionDb, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

const nullableRows = [
  { id: 'n-1', score: null, authorId: 'u-alice' },
  { id: 'n-2', score: 2, authorId: 'u-alice' },
  { id: 'n-3', score: 1, authorId: 'u-alice' },
  { id: 'n-4', score: null, authorId: 'u-bob' },
  { id: 'n-5', score: 2, authorId: 'u-bob' },
  { id: 'n-6', score: 1, authorId: 'u-bob' },
];
const longId = 'x'.repeat(900);
const valueRows = [
  { id: 'v-1', title: '2025-03-15T12:00:00.000Z', score: 1e21, published: 3, at: '00.001' },
  { id: 'v-2', title: '2025-03-15T12:00:00.000Z', score: 1.75, published: 3, at: '00.002' },
  { id: longId, title: 'zzz', score: -0.5, published: 2, at: '00.003' },
];

beforeAll(async () => {
  for (const row of nullableRows) {
    await db.orm.Post.create({
      ...row,
      title: 'nullable-sort',
      content: '',
      published: 1,
      createdAt: new Date('2026-01-01'),
    });
  }
  for (const { at, ...row } of valueRows) {
    await db.orm.Post.create({
      ...row,
      content: 'cursor-values',
      authorId: 'u-bob',
      createdAt: new Date(`2026-01-01T00:00:${at}Z`),
    });
  }
});

type Args = { first?: number; last?: number; after?: string; before?: string };

function pages(orderBy: unknown) {
  const helper = prismaConnectionHelpers(createBuilder(), 'Post', {
    query: { orderBy: orderBy as {} },
  });
  return {
    async read(base: unknown, args: Args) {
      const page = await helper.applyPagination(base as typeof db.orm.Post, args, {});
      return page.wrap(await page.collection.all());
    },
    async cursorOf(row: object) {
      const page = await helper.applyPagination(db.orm.Post, { first: 1 }, {});
      return page.wrap([row as never]).edges[0].cursor;
    },
  };
}

const idsOf = (page: { edges: { node: { id: string } }[] }) => page.edges.map((e) => e.node.id);

describe('cursor values', () => {
  it.each([
    ['ISO-shaped strings', { title: 'asc' }],
    ['large and fractional numbers', { score: 'asc' }],
    ['integers, descending', { published: 'desc' }],
    ['dates with milliseconds', { createdAt: 'asc' }],
    ['a long string near the size cap', {}],
  ])('round trips %s', async (_name, orderBy) => {
    const { read } = pages(orderBy);
    const base = db.orm.Post.where({ content: 'cursor-values' });
    const all = idsOf(await read(base, { first: 10 }));
    expect(all).toHaveLength(3);
    const forward: string[] = [];
    let after: string | undefined;
    for (let i = 0; i < all.length; i += 1) {
      const page = await read(base, { first: 1, after });
      forward.push(...idsOf(page));
      after = page.pageInfo.endCursor!;
    }
    expect(forward).toEqual(all);
    expect((await read(base, { first: 1, after })).edges).toEqual([]);
    const backward: string[] = [];
    let before: string | undefined;
    for (let i = 0; i < all.length; i += 1) {
      const page = await read(base, { last: 1, before });
      backward.unshift(...idsOf(page));
      before = page.pageInfo.startCursor!;
    }
    expect(backward).toEqual(all);
  });

  it('pages a nullable column, with null boundaries kept out of its codec', async () => {
    const byScore = pages({ score: 'asc' });
    const nullable = db.orm.Post.where({ title: 'nullable-sort' });
    const seen: string[] = [];
    let after: string | undefined;
    for (let i = 0; i < nullableRows.length; i += 1) {
      const page = await byScore.read(nullable, { first: 1, after });
      seen.push(...idsOf(page));
      after = page.pageInfo.endCursor!;
    }
    expect(seen).toEqual(['n-3', 'n-6', 'n-2', 'n-5', 'n-1', 'n-4']);
  });

  it('rejects a cursor issued for other columns in the same directions', async () => {
    const byTitle = pages({ title: 'asc' });
    const byContent = pages({ content: 'asc' });
    const cursor = await byTitle.cursorOf({ id: 'n-1', title: 'nullable-sort' });
    await expect(byContent.read(db.orm.Post, { first: 1, after: cursor })).rejects.toThrow(
      /^Invalid cursor\.$/,
    );
  });

  it('accepts a cursor only under the null placement it was issued for', async () => {
    const nullsFirst = pages({ score: { nulls: 'first' } });
    const cursor = await nullsFirst.cursorOf({ id: 'n-1', score: null });
    const base = db.orm.Post.where({ title: 'nullable-sort' });
    expect(idsOf(await nullsFirst.read(base, { first: 1, after: cursor }))).toEqual(['n-4']);
    // The default placement for a nullable column is nulls last.
    for (const orderBy of [{ score: 'asc' }, { score: { nulls: 'last' } }]) {
      await expect(pages(orderBy).read(base, { first: 1, after: cursor })).rejects.toThrow(
        /^Invalid cursor\.$/,
      );
    }
  });

  it.each([
    ['another direction', { score: 'desc' }],
    ['another direction of the appended key', { score: 'asc', id: 'desc' }],
  ])('rejects a cursor under %s', async (_name, orderBy) => {
    const issued = pages({ score: 'asc' });
    const cursor = await issued.cursorOf({ id: 'n-3', score: 1 });
    const base = db.orm.Post.where({ title: 'nullable-sort' });
    expect(idsOf(await issued.read(base, { first: 1, after: cursor }))).toEqual(['n-6']);
    await expect(pages(orderBy).read(base, { first: 1, after: cursor })).rejects.toThrow(
      /^Invalid cursor\.$/,
    );
  });

  it('accepts a cursor under an order naming the appended key column in its direction', async () => {
    const cursor = await pages({ score: 'asc' }).cursorOf({ id: 'n-3', score: 1 });
    const base = db.orm.Post.where({ title: 'nullable-sort' });
    const page = await pages({ score: 'asc', id: 'asc' }).read(base, { first: 1, after: cursor });
    expect(idsOf(page)).toEqual(['n-6']);
  });

  it("rejects a cursor from another model's connection over the same columns", async () => {
    const posts = pages({});
    const users = prismaConnectionHelpers(createBuilder(), 'User', {});
    const cursor = await posts.cursorOf({ id: 'u-alice' });
    await expect(
      users.applyPagination(db.orm.User, { first: 1, after: cursor }, {}),
    ).rejects.toThrow(/^Invalid cursor\.$/);
    const page = await users.applyPagination(db.orm.User, { first: 1 }, {});
    const own = page.wrap([{ id: 'u-alice' } as never]).edges[0].cursor;
    const next = await users.applyPagination(db.orm.User, { first: 1, after: own }, {});
    expect((await next.collection.all()).map((row: { id: string }) => row.id)).toEqual(['u-bob']);
  });

  it('keeps column names out of a cursor', async () => {
    const cursor = await pages({ createdAt: 'desc' }).cursorOf({
      id: 'p-1',
      createdAt: new Date('2026-01-01'),
    });
    const decoded = Buffer.from(cursor, 'base64').toString();
    expect(decoded).toMatch(/^PNC:[0-9a-z]+:T:/);
    expect(decoded).not.toMatch(/createdAt|\bid\b/);
  });

  it('refuses to encode a row missing a cursor column, but encodes a null', async () => {
    const { cursorOf } = pages({ score: 'asc' });
    await expect(cursorOf({ score: 1 })).rejects.toThrow(unexpected(/missing cursor column 'id'/));
    await expect(cursorOf({ id: 'p', score: null })).resolves.toEqual(expect.any(String));
  });

  it('refuses to encode a value its column codec does not hold', async () => {
    class Instant {}
    const { cursorOf } = pages({ createdAt: 'asc' });
    await expect(cursorOf({ id: 'p', createdAt: new Instant() })).rejects.toThrow();
  });

  it('builds a page without encoding cursors until one is read', async () => {
    const helper = prismaConnectionHelpers(createBuilder(), 'Post', {
      query: { orderBy: { title: 'asc' } },
    });
    const page = await helper.applyPagination(db.orm.Post, { first: 2 }, {});
    // A narrowed select without the cursor columns still pages nodes.
    const wrapped = page.wrap([{ id: 'p-1' }, { id: 'p-2' }] as never);
    expect(wrapped.edges.map((edge) => edge.node)).toEqual([{ id: 'p-1' }, { id: 'p-2' }]);
    expect(wrapped.pageInfo.hasNextPage).toBe(false);
    expect(() => wrapped.pageInfo.startCursor).toThrow(unexpected(/missing cursor column 'title'/));
  });

  it('fails only the cursor fields of a row whose cursor cannot be encoded', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    const pages = prismaConnectionHelpers(builder, 'Post', {
      query: { orderBy: { title: 'asc' } },
    });
    builder.queryType({
      fields: (t) => ({
        posts: t.connection({
          type: pages.ref,
          resolve: async (_root, args, context, info) => {
            const page = await pages.applyPagination(
              db.orm.Post.where({ content: 'cursor-values' }),
              args,
              context,
              info,
            );
            const rows = await page.collection.all();
            // A hand-shaped row, such as one served from a cache, without the title column.
            return page.wrap(
              rows.map((row) => (row.id === 'v-2' ? ({ id: row.id } as typeof row) : row)),
            );
          },
        }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      `{ posts(first: 2) {
        nodes { id }
        edges { cursor node { id } }
        pageInfo { hasNextPage startCursor endCursor }
      } }`,
    );
    expect(result.data.posts.nodes).toEqual([{ id: 'v-1' }, { id: 'v-2' }]);
    expect(result.data.posts.edges[0]).toEqual({ cursor: expect.any(String), node: { id: 'v-1' } });
    expect(result.data.posts.edges[1]).toBeNull();
    expect(result.data.posts.pageInfo).toEqual({
      hasNextPage: true,
      startCursor: result.data.posts.edges[0].cursor,
      endCursor: null,
    });
    expect(result.errors?.map((error) => [error.path, detailOf(error)])).toEqual([
      [['posts', 'edges', 1, 'cursor'], expect.stringMatching(/missing cursor column 'title'/)],
      [['posts', 'pageInfo', 'endCursor'], expect.stringMatching(/missing cursor column 'title'/)],
    ]);
  });
});

describe('rejected cursors', () => {
  function schema() {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relatedConnection('posts', { nullable: true }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }),
        posts: t.prismaConnection({ type: 'Post', resolve: () => db.orm.Post }),
        dated: t.prismaConnection({
          type: 'Post',
          query: { orderBy: { createdAt: 'asc' } },
          resolve: () => db.orm.Post,
        }),
      }),
    });
    return builder.toSchema();
  }

  const raw = (payload: string) => Buffer.from(payload).toString('base64');
  const marker = 'PAYLOAD-MARKER';
  // The `PNC:<hash>:` prefix of a real cursor from `field`, so a payload reaches its decoding.
  async function prefixOf(field: string) {
    const page = await run(schema(), `{ ${field}(first: 1) { pageInfo { endCursor } } }`);
    return Buffer.from(page.data[field].pageInfo.endCursor, 'base64')
      .toString()
      .match(/^PNC:[^:]+:/)![0];
  }

  it.each<[string, string, (prefix: string) => string]>([
    ['not base64', 'posts', () => `!!!${marker}`],
    ['from another plugin', 'posts', () => raw(`GPC:S:${marker}`)],
    ['without a hash', 'posts', () => raw(`PNC:S:${marker}`)],
    ['without a separator', 'posts', () => raw('PNC:a')],
    ['not a tagged chunk', 'posts', (prefix) => raw(`${prefix}{"${marker}":1}`)],
    ['wider than the order', 'dated', (prefix) => raw(`${prefix}T:["S:${marker}","S:b","S:c"]`)],
    ['with one value for two columns', 'dated', (prefix) => raw(`${prefix}S:${marker}`)],
    [
      'its column codec cannot decode',
      'dated',
      (prefix) => raw(`${prefix}T:["S:${marker}","S:p"]`),
    ],
    [
      'with a __proto__ object',
      'posts',
      (prefix) => raw(`${prefix}O:{"__proto__":{"polluted":1}}`),
    ],
  ])('rejects a cursor %s without echoing it', async (_name, field, cursor) => {
    const result = await run(
      schema(),
      `query ($c: String) { ${field}(after: $c) { edges { cursor } } }`,
      { variables: { c: cursor(await prefixOf(field)) } },
    );
    expect(result.errors?.map((error) => error.message)).toEqual(['Invalid cursor.']);
    expect(result.statements).toHaveLength(0);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it("rejects another connection's cursor, whose columns differ", async () => {
    const page = await run(schema(), '{ posts(first: 1) { pageInfo { endCursor } } }');
    const result = await run(
      schema(),
      'query ($c: String) { dated(after: $c) { edges { cursor } } }',
      { variables: { c: page.data.posts.pageInfo.endCursor } },
    );
    expect(result.errors?.[0].message).toBe('Invalid cursor.');
    expect(result.statements).toHaveLength(0);
  });

  it('fails the root field whose query holds the bad cursor', async () => {
    const result = await run(
      schema(),
      '{ users { id posts(first: 1, after: "!!!") { edges { node { id } } } } }',
    );
    expect(result.data.users).toBeNull();
    expect(result.errors?.map((error) => [error.path, error.message])).toEqual([
      [['users'], 'Invalid cursor.'],
    ]);
  });

  describe('null boundaries', () => {
    const collision = useCollisionDb();

    it('rejects a null value for a non-null cursor column', async () => {
      const builder = new SchemaBuilder<{ PrismaNextContract: typeof collision.contract }>({
        plugins: [RelayPlugin, prismaNextPlugin],
        relay: {},
        prismaNext: { client: collision.client },
      });
      builder.prismaObject('Note', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.queryType({
        fields: (t) => ({
          byText: t.prismaConnection({
            type: 'Note',
            query: { orderBy: { text: 'asc' } },
            resolve: () => collision.orm.Note,
          }),
          bySheet: t.prismaConnection({
            type: 'Note',
            query: { orderBy: { sheetId: 'asc' } },
            resolve: () => collision.orm.Note,
          }),
        }),
      });
      const s = builder.toSchema();
      const page = await run(s, '{ byText(first: 2) { edges { cursor node { id } } } }');
      const nullText = page.data.byText.edges.find(
        (edge: { node: { id: string } }) => edge.node.id === '21',
      ).cursor;
      // Re-signed for `bySheet`'s columns, so the null itself is what's rejected.
      const sheet = await run(s, '{ bySheet(first: 1) { pageInfo { endCursor } } }');
      const prefix = Buffer.from(sheet.data.bySheet.pageInfo.endCursor, 'base64')
        .toString()
        .match(/^PNC:[^:]+:/)![0];
      const resigned = raw(
        Buffer.from(nullText, 'base64')
          .toString()
          .replace(/^PNC:[^:]+:/, prefix),
      );
      const result = await run(
        s,
        'query ($c: String) { bySheet(after: $c) { edges { cursor } } }',
        { variables: { c: resigned } },
      );
      expect(result.errors?.[0].message).toBe('Invalid cursor.');
    });
  });
});

describe('nullable cursor columns', () => {
  const sorted = (direction: 'asc' | 'desc', nulls: 'first' | 'last') =>
    [...nullableRows].sort((a, b) => {
      if (a.score === null || b.score === null) {
        if (a.score !== b.score) {
          return (a.score === null ? -1 : 1) * (nulls === 'first' ? 1 : -1);
        }
      } else if (a.score !== b.score) {
        return (a.score - b.score) * (direction === 'asc' ? 1 : -1);
      }
      return a.id.localeCompare(b.id);
    });

  describe.each([
    ['asc', 'first'],
    ['asc', 'last'],
    ['desc', 'first'],
    ['desc', 'last'],
  ] as const)('%s, nulls %s', (direction, nulls) => {
    const orderBy = { score: { direction, nulls }, id: 'asc' };

    it('pages every bounded interval forward and backward without losing nulls or ties', async () => {
      const { read, cursorOf } = pages(orderBy);
      const expected = sorted(direction, nulls);
      const cursors = await Promise.all(expected.map((row) => cursorOf(row)));
      const base = db.orm.Post.where({ title: 'nullable-sort' });
      for (let after = -1; after < expected.length; after += 1) {
        for (let before = after + 1; before <= expected.length; before += 1) {
          const bounded = expected.slice(after + 1, before).map(({ id }) => id);
          for (const backward of [false, true]) {
            const page = await read(base, {
              ...(after >= 0 ? { after: cursors[after] } : {}),
              ...(before < expected.length ? { before: cursors[before] } : {}),
              ...(backward ? { last: 2 } : { first: 2 }),
            });
            expect(idsOf(page)).toEqual(backward ? bounded.slice(-2) : bounded.slice(0, 2));
            expect(backward ? page.pageInfo.hasPreviousPage : page.pageInfo.hasNextPage).toBe(
              bounded.length > 2,
            );
          }
        }
      }
    });

    it('orders and limits each included parent independently', async () => {
      const builder = createBuilder();
      builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
      builder.prismaObject('User', {
        fields: (t) => ({
          id: t.exposeID('id'),
          posts: t.relatedConnection('posts', {
            query: {
              where: { title: 'nullable-sort' },
              orderBy: { score: { direction, nulls }, id: 'asc' },
            },
            totalCount: true,
          }),
        }),
      });
      builder.queryType({
        fields: (t) => ({ users: t.prismaField({ type: ['User'], resolve: () => db.orm.User }) }),
      });
      for (const backward of [false, true]) {
        const result = await run(
          builder.toSchema(),
          `{ users { id posts(${backward ? 'last' : 'first'}: 2) { nodes { id } totalCount } } }`,
        );
        expect(result.errors).toBeUndefined();
        for (const user of result.data.users) {
          const expected = sorted(direction, nulls)
            .filter((row) => row.authorId === user.id)
            .map(({ id }) => ({ id }));
          expect(user.posts).toEqual({
            nodes: backward ? expected.slice(-2) : expected.slice(0, 2),
            totalCount: 3,
          });
        }
        expect(result.statements).toHaveLength(1);
      }
    });
  });

  it('defaults nullable columns to nulls last', async () => {
    const builder = createBuilder();
    builder.prismaObject('Post', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        posts: t.prismaConnection({
          type: 'Post',
          query: { orderBy: { score: 'asc', id: 'asc' } },
          resolve: () => db.orm.Post.where({ title: 'nullable-sort' }),
        }),
      }),
    });
    const expected = sorted('asc', 'last').map(({ id }) => ({ id }));
    const result = await run(builder.toSchema(), '{ posts(first: 6) { nodes { id } } }');
    expect(result.data.posts.nodes).toEqual(expected);
    const page = await pages({ score: 'asc' }).read(db.orm.Post.where({ title: 'nullable-sort' }), {
      first: 6,
    });
    expect(page.edges.map((edge) => ({ id: edge.node.id }))).toEqual(expected);
  });
});
