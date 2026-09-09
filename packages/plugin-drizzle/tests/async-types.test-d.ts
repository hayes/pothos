import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';
import { posts } from './example/db/schema';

// The async model widens INPUTS only (A-7): a relation `query`, a count `where`, a field or
// related-field `select` and the connection helpers' callbacks may return promises, while what a
// resolver is handed (the `query()` builder, `nestedSelection`, `getQuery`) keeps its synchronous
// declared type and is awaited by the schema that opted in.
const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: { tenantId: () => Promise<number> };
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});

const commentHelpers = drizzleConnectionHelpers(builder, 'comments', {
  select: async (nodeSelection) => ({ with: { post: nodeSelection() } }),
  query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
});

const Comment = builder.drizzleObject('comments', {
  name: 'Comment',
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
  }),
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    posts: t.relation('posts', {
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    postCount: t.relatedCount('posts', {
      where: async (_args, ctx) => eq(posts.authorId, await ctx.tenantId()),
    }),
    postsTotal: t.relatedField('posts', {
      type: 'Int',
      select: async (buildFilter) => ({
        extras: { postsTotal: (parent) => db.$count(posts, buildFilter(parent)) },
      }),
      resolve: (user) => {
        expectTypeOf(user.postsTotal).toEqualTypeOf<number>();

        return user.postsTotal;
      },
    }),
    postsConnection: t.relatedConnection('posts', {
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    // The parent shape follows the awaited selection.
    titles: t.stringList({
      select: async () => ({ with: { posts: { columns: { title: true } } } }),
      resolve: (user) => {
        expectTypeOf(user.posts[0].title).toEqualTypeOf<string>();

        return user.posts.map((post) => post.title);
      },
    }),
    latestPosts: t.field({
      type: [Post],
      select: async (_args, _ctx, nestedSelection) => ({
        with: { posts: await nestedSelection({ limit: 1 }) },
      }),
      resolve: (user) => user.posts,
    }),
    comments: t.connection({
      type: Comment,
      select: async (args, ctx, nestedSelection) => ({
        with: { comments: await commentHelpers.getQuery(args, ctx, nestedSelection) },
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: User,
      resolve: (query) => {
        expectTypeOf(query({ where: { id: 1 } })).not.toMatchTypeOf<PromiseLike<unknown>>();

        return null as never;
      },
    }),
  }),
});

it('keeps the declared return of the query builder synchronous', () => {
  expectTypeOf(builder).not.toBeAny();
});
