import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import type { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import PrismaPlugin, {
  type PrismaTypesFromClient,
  prismaConnectionHelpers,
  queryFromInfo,
} from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';
import { countPromises } from './promise-spy';

// A plugin that maps a field's arguments asynchronously, as the validation plugin does.
class AsyncArgsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    const mapArgs = fieldConfig.extensions?.mapArgsAsync as
      | ((args: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;

    return mapArgs
      ? { ...fieldConfig, argMappers: [...fieldConfig.argMappers, mapArgs] }
      : fieldConfig;
  }
}

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      asyncArgs: AsyncArgsPlugin<Types>;
    }
  }
}

SchemaBuilder.registerPlugin('asyncArgs', AsyncArgsPlugin);

interface Context {
  user: { id: number };
  promises?: number;
}

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: Context;
}>({
  plugins: [PrismaPlugin, RelayPlugin, 'asyncArgs'],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

const Comment = builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    comments: t.relation('comments', { query: { take: 1, orderBy: { id: 'asc' } } }),
    asyncComments: t.relation('comments', {
      query: async () => {
        await tick();

        return { take: 1, orderBy: { id: 'asc' } };
      },
    }),
  }),
});

const postsQuery = (args: { limit?: number | null }) => ({
  take: args.limit ?? 2,
  orderBy: { id: 'asc' as const },
});

const commentHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  query: () => ({ orderBy: { id: 'asc' as const } }),
});

const asyncCommentHelpers = prismaConnectionHelpers(builder, 'Comment', {
  cursor: 'id',
  query: async () => {
    await tick();

    return { orderBy: { id: 'asc' as const } };
  },
});

// Every async field has a sync twin that plans the same query.
const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    posts: t.relation('posts', { args: { limit: t.arg.int() }, query: postsQuery }),
    asyncPosts: t.relation('posts', {
      args: { limit: t.arg.int() },
      query: async (args) => {
        await tick();

        return postsQuery(args);
      },
    }),
    mappedPosts: t.relation('posts', {
      args: { limit: t.arg.int() },
      extensions: {
        mapArgsAsync: async (args: { limit?: number | null }) => {
          await tick();

          return { limit: (args.limit ?? 1) * 2 };
        },
      },
      query: postsQuery,
    }),
    titles: t.stringList({
      select: { posts: { select: { title: true }, take: 2, orderBy: { id: 'asc' } } },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    asyncTitles: t.stringList({
      select: async () => {
        await tick();

        return { posts: { select: { title: true }, take: 2, orderBy: { id: 'asc' as const } } };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    latestPosts: t.field({
      type: [Post],
      select: async (_args, _ctx, nestedSelection) => ({
        posts: await nestedSelection({ take: 1, orderBy: { id: 'asc' as const } }),
      }),
      resolve: (user) => user.posts,
    }),
    // Forgets to await: a promise when a selection beneath the posts is async.
    unawaitedPosts: t.field({
      type: [Post],
      select: async (_args, _ctx, nestedSelection) => ({
        posts: nestedSelection({ take: 1, orderBy: { id: 'asc' as const } }),
      }),
      resolve: (user) => user.posts,
    }),
    publishedCount: t.relationCount('posts', { where: { published: true } }),
    asyncPublishedCount: t.relationCount('posts', {
      where: async () => {
        await tick();

        return { published: true };
      },
    }),
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: () => ({ orderBy: { id: 'asc' } }),
    }),
    asyncPostsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: async () => {
        await tick();

        return { orderBy: { id: 'asc' } };
      },
    }),
    commentsConnection: t.connection({
      type: Comment,
      select: (args, ctx, nestedSelection) => ({
        comments: commentHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
    asyncCommentsConnection: t.connection({
      type: Comment,
      select: async (args, ctx, nestedSelection) => ({
        comments: await asyncCommentHelpers.getQuery(args, ctx, nestedSelection),
      }),
      resolve: (user, args, ctx) => asyncCommentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
    // A row fetched without the planned selection: every field with a `select` loads its own
    // data through the model loader.
    rawUser: t.field({
      type: User,
      resolve: () => prisma.user.findUniqueOrThrow({ where: { id: 1 } }),
    }),
    // Plans the document under a Promise spy and reports the count on the context.
    spiedUser: t.field({
      type: User,
      resolve: (_root, _args, ctx, info) => {
        const { result, promises } = countPromises(() => queryFromInfo({ context: ctx, info }));

        ctx.promises = promises;

        return prisma.user.findUniqueOrThrow({ ...result, where: { id: 1 } });
      },
    }),
  }),
});

const schema = builder.toSchema();

async function run(document: DocumentNode) {
  const contextValue: Context = { user: { id: 1 } };
  const result = await execute({ schema, document, contextValue });
  const issued = [...queries];

  queries.length = 0;

  return { result, queries: issued, context: contextValue };
}

/** Runs the sync and async twins of one selection and expects the same query and data. */
async function sameAsSync(sync: DocumentNode, async: DocumentNode) {
  const expected = await run(sync);
  const actual = await run(async);

  expect(expected.result.errors).toBeUndefined();
  expect(actual.result.errors).toBeUndefined();
  expect(expected.queries).toHaveLength(1);
  expect(actual.queries).toEqual(expected.queries);
  expect(actual.result.data).toEqual(expected.result.data);

  return actual;
}

describe('async selections', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('plans an async field select like the sync one', async () => {
    const { queries } = await sameAsSync(
      gql`{ user { titles } }`,
      gql`{ user { titles: asyncTitles } }`,
    );

    expect(queries[0]).toMatchObject({
      args: { include: { posts: { select: { title: true }, take: 2 } } },
    });
  });

  it('plans an async relation query like the sync one', async () => {
    const { queries } = await sameAsSync(
      gql`{ user { posts(limit: 3) { id comments { id } } } }`,
      gql`{ user { posts: asyncPosts(limit: 3) { id comments: asyncComments { id } } } }`,
    );

    expect(queries[0]).toMatchObject({
      args: { include: { posts: { take: 3, include: { comments: { take: 1 } } } } },
    });
  });

  it('runs the select once its async arguments are mapped', async () => {
    const { queries } = await sameAsSync(
      gql`{ user { posts(limit: 4) { id } } }`,
      gql`{ user { posts: mappedPosts(limit: 2) { id } } }`,
    );

    expect(queries[0]).toMatchObject({ args: { include: { posts: { take: 4 } } } });
  });

  it('plans an async relation count like the sync one', async () => {
    const { queries } = await sameAsSync(
      gql`{ user { publishedCount } }`,
      gql`{ user { publishedCount: asyncPublishedCount } }`,
    );

    expect(queries[0]).toMatchObject({
      args: { include: { _count: { select: { posts: { where: { published: true } } } } } },
    });
  });

  it('plans an async connection query like the sync one', async () => {
    const { queries } = await sameAsSync(
      gql`{ user { postsConnection(first: 2) { edges { node { id comments { id } } } } } }`,
      gql`{ user { postsConnection: asyncPostsConnection(first: 2) { edges { node { id comments: asyncComments { id } } } } } }`,
    );

    expect(queries[0]).toMatchObject({
      args: { include: { posts: { take: 3, include: { comments: { take: 1 } } } } },
    });
  });

  it('plans async connection helpers like the sync ones when the select awaits getQuery', async () => {
    const { queries } = await sameAsSync(
      gql`{ user { commentsConnection(first: 2) { edges { node { id } } } } }`,
      gql`{ user { commentsConnection: asyncCommentsConnection(first: 2) { edges { node { id } } } } }`,
    );

    expect(queries[0]).toMatchObject({
      args: { include: { comments: { take: 3, orderBy: { id: 'asc' } } } },
    });
  });

  it('merges an awaited nested selection whose walk is async', async () => {
    const { queries } = await sameAsSync(
      gql`{ user { latestPosts { id comments { id } } } }`,
      gql`{ user { latestPosts { id comments: asyncComments { id } } } }`,
    );

    expect(queries[0]).toMatchObject({
      args: { include: { posts: { take: 1, include: { comments: { take: 1 } } } } },
    });
  });

  it('rejects a nested selection that was not awaited', async () => {
    const { result, queries } = await run(
      gql`{ user { unawaitedPosts { id asyncComments { id } } } }`,
    );

    expect(queries).toHaveLength(0);
    expect(result.errors?.map((error) => error.message)).toEqual([
      'Relation "posts" was given a promise. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.',
    ]);
  });

  it('merges the sync sibling first when it conflicts with an async one (D-5)', async () => {
    for (const document of [
      gql`{ user { posts(limit: 1) { id } asyncPosts(limit: 2) { id } } }`,
      gql`{ user { asyncPosts(limit: 2) { id } posts(limit: 1) { id } } }`,
    ]) {
      const { result, queries } = await run(document);

      expect(result.errors).toBeUndefined();
      expect(queries).toHaveLength(2);
      expect(queries[0]).toMatchObject({ args: { include: { posts: { take: 1 } } } });
      // The async sibling lost the conflict and loads on its own.
      expect(queries[1]).toMatchObject({
        action: 'findUniqueOrThrow',
        args: { include: { posts: { take: 2 } }, where: { id: 1 } },
      });
    }
  });

  it('loads a field with an async select through the model loader in one query', async () => {
    const planned = await run(gql`{ user { asyncTitles } }`);
    const { result, queries } = await run(gql`{ rawUser { asyncTitles } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      rawUser: (planned.result.data as { user: unknown }).user,
    });
    expect(queries).toEqual([
      { action: 'findUniqueOrThrow', model: 'User', args: { where: { id: 1 } } },
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          include: { posts: { select: { title: true }, take: 2, orderBy: { id: 'asc' } } },
          where: { id: 1 },
        },
      },
    ]);
  });

  it('creates no promise while planning a synchronous document (A-1)', async () => {
    const { result, queries, context } = await run(gql`
      {
        spiedUser {
          id
          ... on User { posts(limit: 2) { id comments { id } } }
          publishedCount
          commentsConnection(first: 1) { edges { node { id } } }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(queries).toHaveLength(1);
    expect(context.promises).toBe(0);
  });
});
