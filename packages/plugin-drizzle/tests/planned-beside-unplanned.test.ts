import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { and, eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { execute, parse } from 'graphql';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';
import { posts } from './example/db/schema';

// Two parents at one response path: `Planned.user` is loaded with the field's query, and
// `Raw.user` is a row its resolver fetched itself. What the query loaded for the first says
// nothing about the second, even when both select the same thing.
const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations; Context: object }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  relay: {},
  scopeAuth: { authScopes: () => ({}) },
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    n: t.relatedCount('posts', {
      args: { published: t.arg.int({ required: true }) },
      where: (args) => eq(posts.published, args.published),
    }),
    g: t.intList({
      args: { published: t.arg.int({ required: true }) },
      select: (args) => ({
        with: { posts: { where: { published: args.published }, orderBy: { postId: 'asc' } } },
      }),
      resolve: (user) => user.posts.map((post) => post.postId),
    }),
  }),
});

interface Item {
  kind: 'Planned' | 'Raw';
  userId: number;
}

const ItemRef = builder.interfaceRef<Item>('Item').implement({
  resolveType: (item) => item.kind,
  fields: (t) => ({ kind: t.exposeString('kind') }),
});

builder.objectRef<Item>('Planned').implement({
  interfaces: [ItemRef],
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      nullable: true,
      resolve: (query, item) => db.query.users.findFirst(query({ where: { id: item.userId } })),
    }),
  }),
});

builder.objectRef<Item>('Raw').implement({
  interfaces: [ItemRef],
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      nullable: true,
      resolve: (_query, item) => db.query.users.findFirst({ where: { id: item.userId } }),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    items: t.field({
      type: [ItemRef],
      resolve: (): Item[] => [
        { kind: 'Planned', userId: 1 },
        { kind: 'Raw', userId: 1 },
        { kind: 'Planned', userId: 1 },
        { kind: 'Raw', userId: 1 },
      ],
    }),
  }),
});

const schema = builder.toSchema();

async function run(source: string) {
  clearDrizzleLogs();

  const result = await execute({ schema, document: parse(source), contextValue: {} });

  return { result, queries: drizzleLogs.length };
}

const count = (published: number) =>
  db.$count(posts, and(eq(posts.authorId, 1), eq(posts.published, published)));

const postIds = async (published: number) =>
  (
    await db.query.posts.findMany({
      where: { authorId: 1, published },
      orderBy: { postId: 'asc' },
    })
  ).map((post) => post.postId);

describe('a planned parent beside one loaded without the query', () => {
  it.each([
    ['n(published: 1)', 'n(published: 0)', () => count(1), () => count(0)],
    ['g(published: 1)', 'g(published: 0)', () => postIds(1), () => postIds(0)],
    ['g(published: 1)', 'g(published: 1)', () => postIds(1), () => postIds(1)],
  ])('reloads only the parent its query did not load: %s / %s', async (planned, raw, a, b) => {
    const mixed = await run(`{ items {
      ... on Planned { user { x: ${planned} } }
      ... on Raw { user { x: ${raw} } }
    } }`);
    const plannedOnly = await run(`{ items { ... on Planned { user { x: ${planned} } } } }`);
    const rawOnly = await run(`{ items { ... on Raw { user { x: ${raw} } } } }`);
    const [x, y] = [await a(), await b()];

    expect(mixed.result.errors).toBeUndefined();
    expect(mixed.result.data).toEqual({
      items: [{ user: { x } }, { user: { x: y } }, { user: { x } }, { user: { x: y } }],
    });
    // The planned parents resolve from their own query, as they do with no raw parent beside them.
    expect(mixed.queries).toBe(plannedOnly.queries + rawOnly.queries);
  });
});
