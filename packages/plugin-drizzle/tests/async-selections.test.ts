import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { getLoaderMapping } from '@pothos/selection-mapper';
import { execute } from '@pothos/test-utils';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { DocumentNode, GraphQLObjectType } from 'graphql';
import { gql } from 'graphql-tag';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../src';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';
import { posts } from './example/db/schema';
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
  /** The query `user` planned, and a row loaded with it, returned by `spiedUser` as is. */
  planned?: object;
  row?: object;
  /** Promise count and call count of the resolvers wrapped by `spyResolvers`. */
  promises?: number;
  resolved?: number;
}

const builder = new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
  Context: Context;
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin, 'asyncArgs'],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
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
    comments: t.relation('comments', { query: { limit: 1, orderBy: { id: 'asc' } } }),
    asyncComments: t.relation('comments', {
      query: async () => {
        await tick();

        return { limit: 1, orderBy: { id: 'asc' as const } };
      },
    }),
  }),
});

const postsQuery = (args: { limit?: number | null }) => ({
  limit: args.limit ?? 2,
  orderBy: { postId: 'asc' as const },
});

const commentHelpers = drizzleConnectionHelpers(builder, 'comments', {
  query: () => ({ orderBy: { id: 'asc' as const } }),
});

const asyncCommentHelpers = drizzleConnectionHelpers(builder, 'comments', {
  query: async () => {
    await tick();

    return { orderBy: { id: 'asc' as const } };
  },
});

// Every async field has a sync twin that plans the same query.
const User = builder.drizzleObject('users', {
  name: 'User',
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
      select: {
        with: { posts: { columns: { title: true }, limit: 2, orderBy: { postId: 'asc' } } },
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    asyncTitles: t.stringList({
      select: async () => {
        await tick();

        return {
          with: {
            posts: { columns: { title: true }, limit: 2, orderBy: { postId: 'asc' as const } },
          },
        };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    latestPosts: t.field({
      type: [Post],
      select: async (_args, _ctx, nestedSelection) => ({
        with: { posts: await nestedSelection({ limit: 1, orderBy: { postId: 'asc' as const } }) },
      }),
      resolve: (user) => user.posts,
    }),
    // Forgets to await: a promise when a selection beneath the posts is async.
    unawaitedPosts: t.field({
      type: [Post],
      select: async (_args, _ctx, nestedSelection) => ({
        with: { posts: nestedSelection({ limit: 1, orderBy: { postId: 'asc' as const } }) },
      }),
      resolve: (user) => user.posts,
    }),
    // Starts a nested selection and returns without it: its walk is async when a selection
    // beneath the posts is, and would otherwise record mappings for data this never loads.
    discardedPosts: t.field({
      type: [Post],
      // biome-ignore lint/suspicious/useAwait: the select must be async and must not await the nested selection it discards
      select: async (_args, _ctx, nestedSelection) => {
        nestedSelection({ limit: 1, orderBy: { postId: 'asc' as const } });

        return { with: { posts: { limit: 1, orderBy: { postId: 'asc' as const } } } };
      },
      resolve: (user) => user.posts,
    }),
    publishedCount: t.relatedCount('posts', { where: eq(posts.published, 1) }),
    asyncPublishedCount: t.relatedCount('posts', {
      where: async () => {
        await tick();

        return eq(posts.published, 1);
      },
    }),
    postsTotal: t.relatedField('posts', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { postsTotal: (parent) => db.$count(posts, buildFilter(parent)) },
      }),
      resolve: (user) => user.postsTotal,
    }),
    asyncPostsTotal: t.relatedField('posts', {
      type: 'Int',
      select: async (buildFilter) => {
        await tick();

        return { extras: { postsTotal: (parent) => db.$count(posts, buildFilter(parent)) } };
      },
      resolve: (user) => user.postsTotal,
    }),
    postsConnection: t.relatedConnection('posts', {
      query: () => ({ orderBy: { postId: 'asc' } }),
    }),
    asyncPostsConnection: t.relatedConnection('posts', {
      query: async () => {
        await tick();

        return { orderBy: { postId: 'asc' as const } };
      },
    }),
    commentsConnection: t.connection({
      type: Comment,
      select: (args, ctx, nestedSelection) => ({
        with: { comments: commentHelpers.getQuery(args, ctx, nestedSelection) },
      }),
      resolve: (user, args, ctx) => commentHelpers.resolve(user.comments, args, ctx),
    }),
    asyncCommentsConnection: t.connection({
      type: Comment,
      select: async (args, ctx, nestedSelection) => ({
        with: { comments: await asyncCommentHelpers.getQuery(args, ctx, nestedSelection) },
      }),
      resolve: (user, args, ctx) => asyncCommentHelpers.resolve(user.comments, args, ctx),
    }),
  }),
});

// Loaded by id through `loadWithoutCache`, with the selection beneath the node field.
builder.drizzleNode('comments', {
  variant: 'CommentNode',
  id: { column: (comment) => comment.id },
  fields: (t) => ({
    post: t.relation('post'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // The builder is synchronous even when a selection beneath the field is async: the plan is
    // settled before the resolver runs, and the resolver hands the query straight to drizzle.
    user: t.drizzleField({
      type: User,
      resolve: (query, _root, _args, ctx) => {
        ctx.planned = query({ where: { id: 1 } });

        return db.query.users.findFirst(ctx.planned);
      },
    }),
    usersConnection: t.drizzleConnection({
      type: 'users',
      resolve: (query) => db.query.users.findMany(query({ where: { id: 1 } })),
    }),
    // Repeats a planned relation with other arguments: the caller's selection keeps precedence
    // by planning again with it first, which needs every selection beneath to be synchronous.
    userWithPosts: t.drizzleField({
      type: User,
      resolve: (query) =>
        db.query.users.findFirst(
          query({ where: { id: 1 }, with: { posts: { limit: 5, orderBy: { postId: 'asc' } } } }),
        ),
    }),
    // A row fetched without the planned selection: every field with a `select` loads its own
    // data through the model loader.
    rawUser: t.drizzleField({
      type: User,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }),
    }),
    rawUsers: t.drizzleField({
      type: [User],
      resolve: () => db.query.users.findMany({ limit: 3, orderBy: { id: 'asc' } }),
    }),
    // Returns a row the test loaded with the planned query, so the whole resolution (planning
    // included) can run under the Promise spy without a database round trip.
    spiedUser: t.drizzleField({
      type: User,
      resolve: (query, _root, _args, ctx) => {
        query({ where: { id: 1 } });

        return ctx.row as never;
      },
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
  ['User', 'postsTotal'],
  ['User', 'postsConnection'],
  ['User', 'commentsConnection'],
  ['Post', 'comments'],
]);

async function run(document: DocumentNode) {
  clearDrizzleLogs();

  const contextValue: Context = { user: { id: 1 } };
  const result = await execute({ schema, document, contextValue });
  const logs = [...drizzleLogs];

  clearDrizzleLogs();

  return { result, logs, context: contextValue };
}

/** Runs the sync and async twins of one selection and expects the same query and data. */
async function sameAsSync(sync: DocumentNode, async: DocumentNode) {
  const expected = await run(sync);
  const actual = await run(async);

  expect(expected.result.errors).toBeUndefined();
  expect(actual.result.errors).toBeUndefined();
  expect(expected.logs).toHaveLength(1);
  expect(actual.logs).toEqual(expected.logs);
  expect(actual.result.data).toEqual(expected.result.data);

  return actual;
}

describe('async selections', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('plans an async field select like the sync one', async () => {
    const { logs } = await sameAsSync(
      gql`{ user { titles } }`,
      gql`{ user { titles: asyncTitles } }`,
    );

    expect(logs[0]).toContain('"title"');
  });

  it('plans an async relation query like the sync one', async () => {
    const { logs } = await sameAsSync(
      gql`{ user { posts(limit: 3) { id comments { id } } } }`,
      gql`{ user { posts: asyncPosts(limit: 3) { id comments: asyncComments { id } } } }`,
    );

    expect(logs[0]).toContain('"comments"');
  });

  it('runs the select once its async arguments are mapped', async () => {
    const { logs } = await sameAsSync(
      gql`{ user { posts(limit: 4) { id } } }`,
      gql`{ user { posts: mappedPosts(limit: 2) { id } } }`,
    );

    expect(logs[0]).toContain('params: [4, 1, 1]');
  });

  it('plans an async related count like the sync one', async () => {
    await sameAsSync(
      gql`{ user { publishedCount } }`,
      gql`{ user { publishedCount: asyncPublishedCount } }`,
    );
  });

  it('plans an async related field like the sync one', async () => {
    await sameAsSync(gql`{ user { postsTotal } }`, gql`{ user { postsTotal: asyncPostsTotal } }`);
  });

  it('plans an async connection query like the sync one', async () => {
    await sameAsSync(
      gql`{ user { postsConnection(first: 2) { edges { node { id comments { id } } } } } }`,
      gql`{ user { postsConnection: asyncPostsConnection(first: 2) { edges { node { id comments: asyncComments { id } } } } } }`,
    );
  });

  it('plans async connection helpers like the sync ones when the select awaits getQuery', async () => {
    await sameAsSync(
      gql`{ user { commentsConnection(first: 2) { edges { node { id } } } } }`,
      gql`{ user { commentsConnection: asyncCommentsConnection(first: 2) { edges { node { id } } } } }`,
    );
  });

  it('merges an awaited nested selection whose walk is async', async () => {
    await sameAsSync(
      gql`{ user { latestPosts { id comments { id } } } }`,
      gql`{ user { latestPosts { id comments: asyncComments { id } } } }`,
    );
  });

  it('rejects a nested selection that was not awaited', async () => {
    const { result, logs } = await run(
      gql`{ user { unawaitedPosts { id comments: asyncComments { id } } } }`,
    );

    expect(logs).toHaveLength(0);
    expect(result.errors?.map((error) => error.message)).toEqual([
      'The selection function of User.unawaitedPosts returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.',
    ]);
  });

  it('rejects a nested selection that was discarded, recording no mapping for it', async () => {
    const { result, logs, context } = await run(
      gql`{ user { discardedPosts { id comments: asyncComments { id } } } }`,
    );

    expect(logs).toHaveLength(0);
    expect(result.errors?.map((error) => error.message)).toEqual([
      'The selection function of User.discardedPosts returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.',
    ]);
    expect(getLoaderMapping(context, pathOf('user', 'discardedPosts'), 'User')).toBe(null);
  });

  it('merges the sync sibling first when it conflicts with an async one', async () => {
    for (const document of [
      gql`{ user { posts(limit: 1) { id } asyncPosts(limit: 2) { id } } }`,
      gql`{ user { asyncPosts(limit: 2) { id } posts(limit: 1) { id } } }`,
    ]) {
      const { result, logs } = await run(document);

      expect(result.errors).toBeUndefined();
      expect(logs).toHaveLength(2);
      // The planned query pages the sync sibling's limit; the async sibling lost the conflict
      // and loads on its own through the model loader.
      expect(logs[0]).toContain('params: [1, 1, 1]');
      expect(logs[1]).toContain('"d0"."id" in (?)');
      expect(logs[1]).toContain('params: [2, 1]');
    }
  });

  it('loads a field with an async select through the model loader in one query', async () => {
    const planned = await run(gql`{ user { asyncTitles } }`);
    const { result, logs } = await run(gql`{ rawUser { asyncTitles } }`);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ rawUser: (planned.result.data as { user: unknown }).user });
    expect(logs).toHaveLength(2);
    expect(logs[0]).not.toContain('"title"');
    expect(logs[1]).toContain('"title"');
    expect(logs[1]).toContain('"d0"."id" in (?)');
  });

  it('hands a drizzleField resolver a synchronous builder once the async plan settles', async () => {
    const { logs } = await sameAsSync(
      gql`{ user { id titles } }`,
      gql`{ user { id titles: asyncTitles } }`,
    );

    // The resolver passed the builder's result to drizzle without awaiting it: the query still
    // carries its predicate and the async selection's columns.
    expect(logs[0]).toContain('"d0"."id" = ?');
    expect(logs[0]).toContain('"title"');
  });

  it('hands a drizzleConnection resolver a synchronous builder once the async plan settles', async () => {
    const { logs } = await sameAsSync(
      gql`{ usersConnection(first: 1) { edges { node { id titles } } } }`,
      gql`{ usersConnection(first: 1) { edges { node { id titles: asyncTitles } } } }`,
    );

    expect(logs[0]).toContain('"d0"."id" = ?');
    expect(logs[0]).toContain('"title"');
  });

  it('keeps the precedence of a builder selection that conflicts with a synchronous plan', async () => {
    const { result, logs } = await run(gql`{ userWithPosts { posts(limit: 1) { id } } }`);

    expect(result.errors).toBeUndefined();
    // The caller's `posts` was planned first; the field's conflicting `posts` loads on its own.
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain('params: [5, 1, 1]');
    expect(logs[1]).toContain('"d0"."id" in (?)');
    expect(logs[1]).toContain('params: [1, 1]');
  });

  it('keeps the precedence of a builder selection that conflicts with an async plan', async () => {
    const { result, logs } = await run(gql`{ userWithPosts { asyncPosts(limit: 1) { id } } }`);

    expect(result.errors).toBeUndefined();
    // The plan is replayed with the caller's `posts` first; the field's conflicting `posts`
    // loads on its own, as with a synchronous plan.
    expect(logs).toHaveLength(2);
    expect(logs[0]).toContain('params: [5, 1, 1]');
    expect(logs[1]).toContain('"d0"."id" in (?)');
    expect(logs[1]).toContain('params: [1, 1]');
  });

  it('loads every parent of a list through one staged batch', async () => {
    const { result, logs } = await run(gql`{ rawUsers { posts(limit: 1) { id } } }`);

    expect(result.errors).toBeUndefined();
    expect((result.data as { rawUsers: unknown[] }).rawUsers).toHaveLength(3);
    // One batch: every row's synchronous selection staged in the tick the rows resolved in.
    expect(logs).toHaveLength(2);
    expect(logs[1]).toContain('"d0"."id" in (?, ?, ?)');
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
    expect(drizzleLogs).toHaveLength(2);
    expect(drizzleLogs[1]).toContain('"d0"."id" in (?)');
    expect(contextValue.resolved).toBe(3);
    // Exactly the loader's own promises, all created before each resolver returned (planning a
    // synchronous selection creates none): the first field creates the batch (the row's promise,
    // the next tick's promise, and the `then` and `catch` that issue it), and every field chains
    // the mapping step and its resolver onto the row's promise.
    expect(contextValue.promises).toBe(4 + 2 * 3);
  });

  it('issues a node load synchronously, creating only the loader batch promises', async () => {
    const config = builder.configStore.getTypeConfig('CommentNode', 'Object');
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
      const { result, logs } = await run(
        gql`{ node(id: "Q29tbWVudE5vZGU6MQ==") { ... on CommentNode { id post { id } } } }`,
      );

      expect(result.errors).toBeUndefined();
      expect(result.data).toEqual({
        node: { id: 'Q29tbWVudE5vZGU6MQ==', post: { id: expect.any(String) } },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('"d0"."id" in (?)');
      expect(logs[0]).toContain('"post"');
      // The batch (the row's promise, the next tick's promise, and the `then` and `catch` that
      // issue it) and the mapping step, all created before loadWithoutCache returned: planning
      // the synchronous selection created none.
      expect(promises).toBe(4 + 1);
    } finally {
      options.loadWithoutCache = loadWithoutCache;
    }
  });

  it('creates no promise while planning and resolving a synchronous document', async () => {
    const selection = /* GraphQL */ `{
      id
      ... on User { publishedCount }
      postsTotal
      postsConnection(first: 2) { edges { node { id comments { id } } } }
      commentsConnection(first: 1) { edges { node { id } } }
    }`;
    // The row `spiedUser` hands back: loaded with the query the same document plans.
    const planned = await run(gql`{ user ${selection} }`);

    expect(planned.logs).toHaveLength(1);

    const row = await db.query.users.findFirst(planned.context.planned as never);
    clearDrizzleLogs();

    const contextValue: Context = { user: { id: 1 }, row };
    const result = await execute({
      schema,
      document: gql`{ spiedUser ${selection} }`,
      contextValue,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ spiedUser: (planned.result.data as { user: unknown }).user });
    expect(drizzleLogs).toHaveLength(0);
    // The root field (planning + `drizzleField` resolve), the loaded-path count, related field
    // and connection fields for the row, and the loaded-path relation `comments` for each of
    // its two posts.
    expect(contextValue.resolved).toBe(1 + 4 + 2);
    expect(contextValue.promises).toBe(0);
  });
});
