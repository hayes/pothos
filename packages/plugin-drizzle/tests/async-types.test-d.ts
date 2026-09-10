import type { MaybePromise } from '@pothos/core';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import type { PathSegment } from '@pothos/selection-mapper';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { expectTypeOf, it } from 'vitest';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { type DrizzleRelations, db, relations } from './example/db';
import { posts } from './example/db/schema';

// The async model widens INPUTS freely: a relation `query`, a count `where`, a field or
// related-field `select` and the connection helpers' callbacks may return promises. What a
// resolver is handed is synchronous unless it asks otherwise: the `query()` builder is settled
// before the resolver runs, and `getQuery` only returns a promise with `awaitSelections`.
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
        with: {
          comments: await commentHelpers.getQuery(args, ctx, nestedSelection, {
            awaitSelections: true,
          }),
        },
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

declare const connectionArgs: PothosSchemaTypes.DefaultConnectionArguments;
declare const ctx: { tenantId: () => Promise<number> };
declare const nodeSelection: (selection?: {} | true, path?: PathSegment[]) => unknown;
declare const flag: boolean;

it('returns a synchronous query from getQuery by default', () => {
  expectTypeOf(commentHelpers.getQuery(connectionArgs, ctx, nodeSelection)).not.toMatchTypeOf<
    PromiseLike<unknown>
  >();
});

it('returns a MaybePromise from getQuery with awaitSelections', () => {
  const query = commentHelpers.getQuery(connectionArgs, ctx, nodeSelection);

  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: true }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();
});

// A `boolean` that is neither literal infers as `boolean`, which `[Await] extends [false]` sends
// to the promise. The naive `Await extends true` would hand back the synchronous type instead.
it('returns a MaybePromise when awaitSelections is not a literal', () => {
  const query = commentHelpers.getQuery(connectionArgs, ctx, nodeSelection);

  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: flag }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();
});
