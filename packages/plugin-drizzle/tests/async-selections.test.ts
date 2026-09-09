import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { DocumentNode } from 'graphql';
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

builder.queryType({
  fields: (t) => ({
    // The query is a promise when a selection beneath the field is async (A-7).
    user: t.drizzleField({
      type: User,
      resolve: async (query) => db.query.users.findFirst(await query({ where: { id: 1 } })),
    }),
    // A row fetched without the planned selection: every field with a `select` loads its own
    // data through the model loader.
    rawUser: t.drizzleField({
      type: User,
      resolve: () => db.query.users.findFirst({ where: { id: 1 } }),
    }),
    // Plans the document under a Promise spy and reports the count on the context.
    spiedUser: t.drizzleField({
      type: User,
      resolve: (query, _root, _args, ctx) => {
        const { result, promises } = countPromises(() => query({ where: { id: 1 } }));

        ctx.promises = promises;

        return db.query.users.findFirst(result);
      },
    }),
  }),
});

const schema = builder.toSchema();

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
      'Relation "posts" was given a promise. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.',
    ]);
  });

  it('merges the sync sibling first when it conflicts with an async one (D-5)', async () => {
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

  it('creates no promise while planning a synchronous document (A-1)', async () => {
    const { result, logs, context } = await run(gql`
      {
        spiedUser {
          id
          ... on User { posts(limit: 2) { id comments { id } } }
          publishedCount
          postsTotal
          commentsConnection(first: 1) { edges { node { id } } }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(logs).toHaveLength(1);
    expect(context.promises).toBe(0);
  });
});
