import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { parse } from 'graphql';
import DrizzlePlugin from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

// An implementation that redefines an interface field with other relation arguments, selected
// beneath the interface: the interface's plan must not answer for it.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { typeName: string };
}>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

const Linked = builder.interfaceRef<object>('Linked').implement({
  fields: (t) => ({ linked: t.string({ resolve: () => 'linked' }) }),
});

const Post = builder.drizzleObject('posts', {
  name: 'OverridePost',
  fields: (t) => ({ id: t.exposeID('postId') }),
});

const OverrideUser = builder.drizzleInterface('users', {
  variant: 'OverrideUser',
  select: { columns: { id: true } },
  resolveType: (_user, ctx) => ctx.typeName,
  fields: (t) => ({
    posts: t.relation('posts', { type: Post, query: { limit: 3, orderBy: { postId: 'asc' } } }),
    // The same relation through a static field select.
    recent: t.field({
      type: [Post],
      select: { with: { posts: { limit: 3, orderBy: { postId: 'asc' } } } },
      resolve: (user) => user.posts,
    }),
  }),
});

builder.drizzleObject('users', {
  variant: 'InheritingUser',
  interfaces: [OverrideUser, Linked],
  select: { columns: { id: true } },
});
builder.drizzleObject('users', {
  variant: 'OverridingUser',
  interfaces: [OverrideUser, Linked],
  select: { columns: { id: true } },
  fields: (t) => ({
    posts: t.relation('posts', { type: Post, query: { limit: 1, orderBy: { postId: 'desc' } } }),
    recent: t.field({
      type: [Post],
      select: { with: { posts: { limit: 1, orderBy: { postId: 'desc' } } } },
      resolve: (user) => user.posts,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: OverrideUser,
      resolve: (query) => db.query.users.findFirst(query({ where: { id: 1 } })),
    }),
  }),
});

const schema = builder.toSchema();

describe('an implementation that overrides an interface field', () => {
  const ids = async (limit: number, order: 'asc' | 'desc') =>
    (
      await db.query.posts.findMany({
        where: { authorId: 1 },
        limit,
        orderBy: { postId: order },
        columns: { postId: true },
      })
    ).map((post) => ({ id: String(post.postId) }));

  afterEach(() => {
    clearDrizzleLogs();
  });

  it.each(
    ['posts', 'recent'].flatMap((field) => [
      [field, 'plainly', `{ user { ${field} { id } } }`],
      [
        field,
        'beneath an expansion',
        `{ user { ... on Linked { ... on OverrideUser { ${field} { id } } } } }`,
      ],
    ]),
  )('loads the override of %s with its own arguments when selected %s', async (field, _, document) => {
    const overriding = await ids(1, 'desc');
    const inherited = await ids(3, 'asc');

    clearDrizzleLogs();

    const result = await execute({
      schema,
      document: parse(document),
      contextValue: { typeName: 'OverridingUser' },
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { [field]: overriding } });
    // The parent query loads the interface's selection, which the override does not read, and the
    // override reloads the user. A static select plans nothing beneath it, so the posts it
    // returns load their own `id` once more.
    expect(drizzleLogs).toHaveLength(field === 'posts' ? 2 : 3);

    clearDrizzleLogs();

    const inheriting = await execute({
      schema,
      document: parse(document),
      contextValue: { typeName: 'InheritingUser' },
    });

    expect(inheriting.errors).toBeUndefined();
    expect(inheriting.data).toEqual({ user: { [field]: inherited } });
    expect(drizzleLogs).toHaveLength(field === 'posts' ? 1 : 2);
  });
});
