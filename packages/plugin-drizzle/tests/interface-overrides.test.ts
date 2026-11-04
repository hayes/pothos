import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';
import { posts } from './example/db/schema';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

const page = { limit: 3, orderBy: { postId: 'asc' } } as const;

const Post = builder.drizzleObject('posts', {
  name: 'OverriddenPost',
  fields: (t) => ({ id: t.exposeID('postId') }),
});
// Shared, so the override's connection has the interface's type.
const PostConnection = builder.connectionObject({ type: Post, name: 'OverriddenPostConnection' });

// `I` is implemented by A, which inherits its fields, and B, which overrides them.
const I = builder.drizzleInterface('users', {
  name: 'OverriddenUser',
  resolveType: (user) => (user.id === 2 ? 'OverridingUser' : 'InheritingUser'),
  fields: (t) => ({
    id: t.exposeID('id'),
    pub: t.relation('posts', { query: { ...page, where: { published: 1 } } }),
    narrowed: t.relation('posts', { query: page }),
    widened: t.relation('posts', { query: { ...page, where: { published: 1 } } }),
    count: t.relatedCount('posts', { where: eq(posts.published, 1) }),
    connection: t.relatedConnection(
      'posts',
      { query: { where: { published: 1 }, orderBy: { postId: 'asc' } } },
      PostConnection,
    ),
    selected: t.idList({
      select: { with: { posts: { ...page, where: { published: 1 } } } },
      resolve: (user) => user.posts.map((post) => post.postId),
    }),
    computed: t.idList({
      select: () => ({ with: { posts: { ...page, where: { published: 1 } } } }),
      resolve: (user) => user.posts.map((post) => post.postId),
    }),
  }),
});

builder.drizzleObject('users', { variant: 'InheritingUser', interfaces: [I] });
builder.drizzleObject('users', {
  variant: 'OverridingUser',
  interfaces: [I],
  fields: (t) => ({
    pub: t.relation('posts', { query: { ...page, where: { published: 0 } } }),
    narrowed: t.relation('posts', { query: { ...page, where: { published: 0 } } }),
    widened: t.relation('posts', { query: page }),
    count: t.relatedCount('posts', { where: eq(posts.published, 0) }),
    connection: t.relatedConnection(
      'posts',
      { query: { where: { published: 0 }, orderBy: { postId: 'asc' } } },
      PostConnection,
    ),
    selected: t.idList({
      select: { with: { posts: { ...page, where: { published: 0 } } } },
      resolve: (user) => user.posts.map((post) => post.postId),
    }),
    computed: t.idList({
      select: () => ({ with: { posts: { ...page, where: { published: 0 } } } }),
      resolve: (user) => user.posts.map((post) => post.postId),
    }),
  }),
});

// `Middle` inherits `pub` from `I` without overriding it, and `Leaf` inherits it from `Middle`.
const Middle = builder.drizzleInterface('users', {
  variant: 'Middle',
  interfaces: [I],
  resolveType: () => 'Leaf',
});
builder.drizzleObject('users', { variant: 'Leaf', interfaces: [I, Middle] });

builder.queryType({
  fields: (t) => ({
    users: t.drizzleField({
      type: [I],
      resolve: (query) =>
        db.query.users.findMany(query({ where: { id: { in: [1, 2] } }, orderBy: { id: 'asc' } })),
    }),
    middles: t.drizzleField({
      type: [Middle],
      resolve: (query) => db.query.users.findMany(query({ where: { id: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

async function run(source: string) {
  clearDrizzleLogs();
  const result = (await execute({ schema, document: gql(source), contextValue: {} })) as {
    data: Record<string, Record<string, unknown>[]>;
    errors?: unknown;
  };

  return { ...result, queries: drizzleLogs.length };
}

async function postIds(authorId: number, published?: number, limit: number | null = 3) {
  const rows = await db.query.posts.findMany({
    where: published === undefined ? { authorId } : { authorId, published },
    limit: limit ?? undefined,
    orderBy: { postId: 'asc' },
    columns: { postId: true },
  });

  return rows.map((post) => String(post.postId));
}

const ids = (rows: unknown) => (rows as { id: string }[]).map((row) => row.id);

describe("an implementation's override of an interface field", () => {
  it.each([
    ['a filter replacing the interface filter', 'pub', 1, 0],
    ['a filter over an unfiltered interface field', 'narrowed', undefined, 0],
    ['no filter over a filtered interface field', 'widened', 1, undefined],
  ] as const)('applies %s', async (_name, field, inherited, overridden) => {
    const result = await run(`{ users { id ${field} { id } } }`);

    expect(result.errors).toBeUndefined();
    expect(ids(result.data.users[0][field])).toEqual(await postIds(1, inherited));
    expect(ids(result.data.users[1][field])).toEqual(await postIds(2, overridden));
    // One query for the users and the inheriting implementation, one reload for the override.
    expect(result.queries).toBe(2);
  });

  it('applies an overriding relation count', async () => {
    const result = await run('{ users { id count } }');

    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: '1', count: (await postIds(1, 1, null)).length },
      { id: '2', count: (await postIds(2, 0, null)).length },
    ]);
    expect(result.queries).toBe(2);
  });

  it('applies an overriding related connection', async () => {
    const result = await run('{ users { id connection(first: 2) { edges { node { id } } } } }');

    expect(result.errors).toBeUndefined();
    const nodes = (index: number) =>
      (result.data.users[index].connection as { edges: { node: { id: string } }[] }).edges.map(
        (edge) => edge.node.id,
      );
    expect(nodes(0)).toEqual(await postIds(1, 1, 2));
    expect(nodes(1)).toEqual(await postIds(2, 0, 2));
    expect(result.queries).toBe(2);
  });

  it.each(['selected', 'computed'])('applies an overriding %s select', async (field) => {
    const result = await run(`{ users { id ${field} } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data.users).toEqual([
      { id: '1', [field]: await postIds(1, 1) },
      { id: '2', [field]: await postIds(2, 0) },
    ]);
    expect(result.queries).toBe(2);
  });

  it('resolves a field inherited through an intermediate interface from the planned query', async () => {
    const result = await run('{ middles { id pub { id } } }');

    expect(result.errors).toBeUndefined();
    expect(ids(result.data.middles[0].pub)).toEqual(await postIds(1, 1));
    expect(result.queries).toBe(1);
  });

  it('resolves an override and an inherited field selected through fragments', async () => {
    const result = await run(
      '{ users { id ... on OverridingUser { pub { id } } ... on InheritingUser { pub { id } } } }',
    );

    expect(result.errors).toBeUndefined();
    expect(ids(result.data.users[0].pub)).toEqual(await postIds(1, 1));
    expect(ids(result.data.users[1].pub)).toEqual(await postIds(2, 0));
    // The two fragments select the relation with conflicting filters, so one of them reloads.
    expect(result.queries).toBe(2);
  });
});
