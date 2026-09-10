import type { MaybePromise } from '@pothos/core';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, {
  type PathSegment,
  type PrismaTypesFromClient,
  prismaConnectionHelpers,
  queryFromInfo,
  type SelectionMap,
} from '../src';
import type { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

// The async model widens INPUTS freely: a relation `query`, a count `where`, a field `select` and
// the connection helpers' callbacks may return promises. What a resolver is handed is synchronous
// unless it asks otherwise: `queryFromInfo` and `getQuery` return a query, and only return a
// promise for a caller that passed `awaitSelections`.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { tenantId: () => Promise<number> };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: () => null as never,
    dmmf: getDatamodel(),
  },
});

const commentHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  select: async (nodeSelection) => ({ id: true, post: nodeSelection({}) }),
  query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
  resolveNode: (comment) => comment.post,
});

builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const User = builder.prismaObject('User', {
  select: { id: true },
  fields: (t) => ({
    posts: t.relation('posts', {
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    postCount: t.relationCount('posts', {
      where: async (_args, ctx) => ({ authorId: await ctx.tenantId() }),
    }),
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: async (_args, ctx) => ({ where: { authorId: await ctx.tenantId() } }),
    }),
    // The parent shape follows the awaited selection.
    titles: t.stringList({
      select: async (_args, _ctx, nestedSelection) => ({
        posts: await nestedSelection({ select: { title: true } }),
      }),
      resolve: (user) => {
        expectTypeOf(user.posts[0].title).toEqualTypeOf<string>();

        return user.posts.map((post) => post.title);
      },
    }),
    comments: t.connection({
      type: Post,
      select: async (args, ctx, nestedSelection) => ({
        comments: await commentHelpers.getQuery(args, ctx, nestedSelection, {
          awaitSelections: true,
        }),
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => {
        expectTypeOf(query).not.toMatchTypeOf<PromiseLike<unknown>>();

        return null as never;
      },
    }),
  }),
});

declare const info: GraphQLResolveInfo;
declare const flag: boolean;

it('returns a synchronous query from queryFromInfo by default', () => {
  expectTypeOf(queryFromInfo({ context: {}, info })).not.toMatchTypeOf<PromiseLike<unknown>>();
});

it('returns a MaybePromise from queryFromInfo with awaitSelections', () => {
  const query = queryFromInfo({ context: {}, info });

  expectTypeOf(queryFromInfo({ context: {}, info, awaitSelections: true })).toEqualTypeOf<
    MaybePromise<typeof query>
  >();
});

// A `boolean` that is neither literal infers as `boolean`, which `[Await] extends [false]` sends
// to the promise. The naive `Await extends true` would hand back the synchronous type instead.
it('returns a MaybePromise when awaitSelections is not a literal', () => {
  const query = queryFromInfo({ context: {}, info });

  expectTypeOf(queryFromInfo({ context: {}, info, awaitSelections: flag })).toEqualTypeOf<
    MaybePromise<typeof query>
  >();
});

declare const connectionArgs: PothosSchemaTypes.DefaultConnectionArguments;
declare const nodeSelection: (selection?: SelectionMap | true, path?: PathSegment[]) => unknown;

it('returns a synchronous query from getQuery by default', () => {
  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, { tenantId: async () => 1 }, nodeSelection),
  ).not.toMatchTypeOf<PromiseLike<unknown>>();
});

it('returns a MaybePromise from getQuery with awaitSelections', () => {
  const ctx = { tenantId: async () => 1 };
  const query = commentHelpers.getQuery(connectionArgs, ctx, nodeSelection);

  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: true }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();

  expectTypeOf(
    commentHelpers.getQuery(connectionArgs, ctx, nodeSelection, { awaitSelections: flag }),
  ).toEqualTypeOf<MaybePromise<typeof query>>();
});
