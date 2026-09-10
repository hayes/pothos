import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { getLoaderMapping } from '@pothos/selection-mapper';
import { execute } from '@pothos/test-utils';
import type { DocumentNode, GraphQLObjectType } from 'graphql';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient, prismaConnectionHelpers } from '../src';
import { ModelLoader } from '../src/model-loader';
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
  namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      asyncArgs: AsyncArgsPlugin<Types>;
    }
  }
}

SchemaBuilder.registerPlugin('asyncArgs', AsyncArgsPlugin);

interface Context {
  user: { id: number };
  /** A row already loaded with the planned selection, returned by `spiedUser` as is. */
  row?: object;
  /** Promise count and call count of the resolvers wrapped by `spyResolvers`. */
  promises?: number;
  resolved?: number;
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

function pathOf(...keys: (string | number)[]) {
  let path: { prev: unknown; key: string | number; typename: undefined } | undefined;

  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }

  return path as never;
}

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
    // Starts a nested selection and returns without it: its walk is async when a selection
    // beneath the posts is, and would otherwise record mappings for data this never loads.
    discardedPosts: t.field({
      type: [Post],
      // biome-ignore lint/suspicious/useAwait: the select must be async and must not await the nested selection it discards
      select: async (_args, _ctx, nestedSelection) => {
        nestedSelection({ take: 1, orderBy: { id: 'asc' as const } });

        return { posts: { take: 1, orderBy: { id: 'asc' as const } } };
      },
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

// Loaded by id through `loadWithoutCache`, with the selection beneath the node field.
builder.prismaNode('Profile', {
  id: { field: 'id' },
  fields: (t) => ({
    bio: t.exposeString('bio', { nullable: true }),
    user: t.relation('user'),
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
    rawUsers: t.field({
      type: [User],
      resolve: () => prisma.user.findMany({ take: 3, orderBy: { id: 'asc' } }),
    }),
    // Returns a row the test loaded with the planned query, so the whole resolution (planning
    // included) can run under the Promise spy without a database round trip.
    spiedUser: t.prismaField({
      type: User,
      resolve: (_query, _root, _args, ctx) => ctx.row as never,
    }),
  }),
});

const schema = builder.toSchema();

/** Wraps the built resolvers of `fields` so every call is counted under the Promise spy. */
function spyResolvers(fields: [string, string][]) {
  for (const [typeName, fieldName] of fields) {
    const field = (schema.getType(typeName) as GraphQLObjectType).getFields()[fieldName];
    const { resolve } = field;

    field.resolve = (parent, args, ctx: Context, info) => {
      const { result, promises } = countPromises(() => resolve!(parent, args, ctx, info));

      ctx.promises = (ctx.promises ?? 0) + promises;
      ctx.resolved = (ctx.resolved ?? 0) + 1;

      return result;
    };
  }
}

spyResolvers([
  ['Query', 'spiedUser'],
  ['User', 'posts'],
  ['User', 'publishedCount'],
  ['User', 'postsConnection'],
  ['User', 'commentsConnection'],
  ['Post', 'comments'],
]);

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
    // A spied method chains onto the promise it returns, which the Promise spy would count.
    vi.restoreAllMocks();
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
      'The selection function of User.unawaitedPosts returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.',
    ]);
  });

  it('rejects a nested selection that was discarded, recording no mapping for it', async () => {
    const { result, queries, context } = await run(
      gql`{ user { discardedPosts { id asyncComments { id } } } }`,
    );

    expect(queries).toHaveLength(0);
    expect(result.errors?.map((error) => error.message)).toEqual([
      'The selection function of User.discardedPosts returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.',
    ]);
    expect(getLoaderMapping(context, pathOf('user', 'discardedPosts'), 'User')).toBe(null);
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

  it('loads every parent of a list through one staged batch', async () => {
    const initLoad = vi.spyOn(ModelLoader.prototype, 'initLoad');
    const { result, queries } = await run(gql`{ rawUsers { posts(limit: 1) { id } } }`);

    expect(result.errors).toBeUndefined();
    expect((result.data as { rawUsers: unknown[] }).rawUsers).toHaveLength(3);
    // One batch: every row's synchronous selection staged in the tick the rows resolved in.
    expect(initLoad).toHaveBeenCalledTimes(1);
    expect(queries.map((query) => (query as { action: string }).action)).toEqual([
      'findMany',
      'findUniqueOrThrow',
      'findUniqueOrThrow',
      'findUniqueOrThrow',
    ]);
    expect(
      new Set(
        queries
          .slice(1)
          .map((query) => JSON.stringify((query as { args: { include: unknown } }).args.include)),
      ).size,
    ).toBe(1);
  });

  it('stages an unloaded row synchronously, creating only the loader batch promises', async () => {
    const contextValue: Context = { user: { id: 1 } };
    const result = await execute({
      schema,
      document: gql`{
        rawUser {
          posts(limit: 2) { id }
          publishedCount
          commentsConnection(first: 1) { edges { node { id } } }
        }
      }`,
      contextValue,
    });

    expect(result.errors).toBeUndefined();
    // The raw row, then the one batch the relation, the count and the connection staged into.
    expect(queries.map((query) => (query as { action: string }).action)).toEqual([
      'findUniqueOrThrow',
      'findUniqueOrThrow',
    ]);
    expect(contextValue.resolved).toBe(3);
    // Exactly the loader's own promises, all created before each resolver returned (planning a
    // synchronous selection creates none): the first field creates the loader (its `tick`) and
    // the batch (the row's promise, the next tick's promise, and the `tick.then` that issues the
    // batch), and every field chains the mapping step and its resolver onto the row's promise.
    expect(contextValue.promises).toBe(1 + 3 + 2 * 3);
    queries.length = 0;
  });

  it('issues a node load synchronously, creating no promise beyond the query itself', async () => {
    const config = builder.configStore.getTypeConfig('Profile', 'Object');
    const options = config.pothosOptions as {
      loadWithoutCache: (id: string, context: Context, info: unknown) => unknown;
    };
    const { loadWithoutCache } = options;
    let promises = -1;

    options.loadWithoutCache = (id, context, info) => {
      const counted = countPromises(() => loadWithoutCache(id, context, info));

      promises = counted.promises;

      return counted.result;
    };

    try {
      const { result, queries: issuedQueries } = await run(
        gql`{ node(id: "UHJvZmlsZTox") { ... on Profile { bio user { id } } } }`,
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({ node: { bio: expect.any(String), user: { id: '1' } } });
      expect(issuedQueries).toMatchObject([
        { action: 'findUniqueOrThrow', model: 'Profile', args: { include: { user: true } } },
      ]);
      // The query was issued, and its result chained, before loadWithoutCache returned: the
      // synchronous window holds exactly the promises issuing the query itself creates, and
      // planning added none.
      const baseline = countPromises(() =>
        prisma.profile.findUniqueOrThrow({ where: { id: 1 } }).then((record) => record),
      );

      await baseline.result;
      expect(baseline.promises).toBeGreaterThan(0);
      expect(promises).toBe(baseline.promises);
    } finally {
      options.loadWithoutCache = loadWithoutCache;
    }
  });

  it('creates no promise while planning and resolving a synchronous document (A-1)', async () => {
    const selection = /* GraphQL */ `{
      id
      ... on User { publishedCount }
      postsConnection(first: 2) { edges { node { id comments { id } } } }
      commentsConnection(first: 1) { edges { node { id } } }
    }`;
    // The row `spiedUser` hands back: loaded with the query the same document plans.
    const planned = await run(gql`{ user ${selection} }`);

    expect(planned.queries).toHaveLength(1);

    const row = await prisma.user.findUniqueOrThrow(
      (planned.queries[0] as { args: { where: { id: number } } }).args,
    );
    queries.length = 0;

    const contextValue: Context = { user: { id: 1 }, row };
    const result = await execute({
      schema,
      document: gql`{ spiedUser ${selection} }`,
      contextValue,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ spiedUser: (planned.result.data as { user: unknown }).user });
    expect(queries).toHaveLength(0);
    // The root field (planning + `prismaField` resolve), the loaded-path count and connection
    // fields for the row, and the loaded-path relation `comments` for each of its two posts.
    expect(contextValue.resolved).toBe(1 + 3 + 2);
    expect(contextValue.promises).toBe(0);
  });
});
