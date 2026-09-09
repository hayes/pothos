import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf, it } from 'vitest';
import PrismaPlugin, {
  type PrismaTypesFromClient,
  prismaConnectionHelpers,
  queryFromInfo,
} from '../src';
import type { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

// The async model widens INPUTS only (A-7): a relation `query`, a count `where`, a field `select`
// and the connection helpers' callbacks may return promises, while what a resolver is handed
// (`queryFromInfo`, `nestedSelection`, `getQuery`) keeps its synchronous declared type and is
// awaited by the schema that opted in.
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
        comments: await commentHelpers.getQuery(args, ctx, nestedSelection),
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

it('keeps the declared return of queryFromInfo synchronous', () => {
  expectTypeOf(queryFromInfo).returns.not.toMatchTypeOf<PromiseLike<unknown>>();
});
