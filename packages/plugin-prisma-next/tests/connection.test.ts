import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin, { type ModelAccessor, prismaConnectionHelpers } from '../src';
import {
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;

beforeAll(async () => {
  ctx = await createTestRuntime();
});

afterAll(async () => {
  await ctx?.cleanup();
});

function buildSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: {
      contract: ctx.contract,
    },
  });

  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      email: t.exposeString('email'),
      postsConnection: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
      }),
      postsConnectionWithCount: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
      }),
      // Two counts on one relation need separate aliases.
      postsConnectionWithCountAlt: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
      }),
      // The count must apply the same `refine` as the page.
      publishedPostsConnection: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
        where: { published: 1 },
      }),
      postsConnectionWithCallableCount: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
        totalCount: () => 999,
      }),
    }),
  });

  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      published: t.exposeInt('published'),
    }),
  });

  builder.prismaNode('Comment', {
    id: { field: 'id' },
    collection: ctx.ormClient.Comment,
    fields: (t) => ({
      body: t.exposeString('body'),
      author: t.relation('author'),
    }),
  });

  // Registered under a variant name so it doesn't clash with the regular Post type.
  builder.prismaNode('Post', {
    name: 'PostByComposite',
    id: {
      field: ['authorId', 'id'],
    },
    collection: ctx.ormClient.Post,
    fields: (t) => ({
      title: t.exposeString('title'),
    }),
  });

  const userSearch = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
  });

  const userSearchWithCount = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    totalCount: true,
  });

  const userSearchCustomCount = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    totalCount: () => 7,
  });

  const aliceOnly = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    where: (u: ModelAccessor<SampleContract, 'User'>) => u.firstName.eq('Alice'),
    totalCount: true,
  });

  const namesOnly = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    resolveNode: (edge) => ({ id: edge.id, name: edge.firstName }),
  });

  const decoratedUsers = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    resolveNode: (row) => ({ user: row, decoratedAt: 'decorated' }),
  });

  const DecoratedUser = builder
    .objectRef<{ user: { id: string; firstName: string }; decoratedAt: string }>('DecoratedUser')
    .implement({
      fields: (t) => ({
        userId: t.string({ resolve: (parent) => parent.user.id }),
        firstName: t.string({ resolve: (parent) => parent.user.firstName }),
        decoratedAt: t.exposeString('decoratedAt'),
      }),
    });

  const userSearchThunkArgs = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    args: (t) => ({ q: t.string({ required: true }) }),
  });

  builder.queryType({
    fields: (t) => ({
      searchUsers: t.connection({
        type: userSearch.ref,
        args: { ...userSearch.getArgs(), search: t.arg.string({ required: true }) },
        resolve: async (_parent, args, _ctx, info) => {
          const { collection, wrap } = await userSearch.applyPagination(
            ctx.ormClient.User,
            args,
            info,
            _ctx,
          );
          const rows = await collection
            .where((u: ModelAccessor<SampleContract, 'User'>) => u.firstName.eq(args.search))
            .all();
          return wrap(rows) as never;
        },
      }),
      searchUsersWithCount: t.connection(
        {
          type: userSearchWithCount.ref,
          args: userSearchWithCount.getArgs(),
          resolve: async (_parent, args, _ctx, info) => {
            const { collection, wrap, totalCountPromise } =
              await userSearchWithCount.applyPagination(ctx.ormClient.User, args, info, _ctx);
            const [rows, total] = await Promise.all([
              collection.all(),
              totalCountPromise ?? Promise.resolve(undefined),
            ]);
            return wrap(rows, total) as never;
          },
        },
        userSearchWithCount.connectionOptions({}),
      ),
      aliceOnly: t.connection(
        {
          type: aliceOnly.ref,
          args: aliceOnly.getArgs(),
          resolve: async (_p, args, _ctx, info) => {
            const { collection, wrap, totalCountPromise } = await aliceOnly.applyPagination(
              ctx.ormClient.User,
              args,
              info,
              _ctx,
            );
            const [rows, total] = await Promise.all([
              collection.all(),
              totalCountPromise ?? Promise.resolve(undefined),
            ]);
            return wrap(rows, total) as never;
          },
        },
        aliceOnly.connectionOptions({}),
      ),
      namesOnly: t.connection({
        type: namesOnly.ref,
        args: namesOnly.getArgs(),
        resolve: async (_p, args, _ctx, info) => {
          const { collection, wrap } = await namesOnly.applyPagination(
            ctx.ormClient.User,
            args,
            info,
            _ctx,
          );
          const rows = await collection.all();
          return wrap(rows) as never;
        },
      }),
      decoratedUsers: t.connection({
        type: DecoratedUser,
        args: decoratedUsers.getArgs(),
        resolve: async (_p, args, _ctx) => {
          const { collection, wrap } = await decoratedUsers.applyPagination(
            ctx.ormClient.User,
            args,
            undefined,
            _ctx,
          );
          const rows = await collection.all();
          return wrap(rows);
        },
      }),
      searchUsersCustomCount: t.connection(
        {
          type: userSearchCustomCount.ref,
          args: userSearchCustomCount.getArgs(),
          resolve: async (_parent, args, _ctx, info) => {
            const { collection, wrap, totalCountPromise } =
              await userSearchCustomCount.applyPagination(ctx.ormClient.User, args, info, _ctx);
            const [rows, total] = await Promise.all([
              collection.all(),
              totalCountPromise ?? Promise.resolve(undefined),
            ]);
            return wrap(rows, total) as never;
          },
        },
        userSearchCustomCount.connectionOptions({}),
      ),
      searchUsersThunk: t.connection({
        type: userSearchThunkArgs.ref,
        args: userSearchThunkArgs.getArgs(),
        resolve: async (_parent, args, _ctx, info) => {
          const { collection, wrap } = await userSearchThunkArgs.applyPagination(
            ctx.ormClient.User,
            args,
            info,
            _ctx,
          );
          const rows = await collection
            .where((u: ModelAccessor<SampleContract, 'User'>) => u.firstName.eq(args.q))
            .all();
          return wrap(rows) as never;
        },
      }),
      users: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        maxSize: 100,
        resolve: (() => ctx.ormClient.User) as never,
      }),
      usersWithCount: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
        resolve: (() => ctx.ormClient.User) as never,
      }),
      usersWithCustomCount: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: () => 42,
        resolve: (() => ctx.ormClient.User) as never,
      }),
      usersCountRejects: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: () => Promise.reject(new Error('count-failed')),
        resolve: (() => ctx.ormClient.User) as never,
      }),
      usersRowsRejectsAndCount: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: () => 9,
        resolve: (() => Promise.reject(new Error('rows-failed'))) as never,
      }),
      usersCountSyncThrows: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: (() => {
          throw new Error('sync-throw');
        }) as never,
        resolve: (() => ctx.ormClient.User) as never,
      }),
      posts: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        resolve: (() => ctx.ormClient.Post) as never,
      }),
      postsByDate: t.prismaConnection({
        type: 'Post',
        cursor: ['createdAt', 'id'],
        resolve: (() => ctx.ormClient.Post) as never,
      }),
    }),
  });

  return builder.toSchema();
}

function runQuery(query: string) {
  return execute({ schema: buildSchema(), document: parse(query), contextValue: {} });
}

describe('prismaConnection: end-to-end against real sqlite', () => {
  it('returns the first page with edges and pageInfo', async () => {
    const result = await runQuery(`{
      users(first: 10) {
        edges { cursor node { id firstName } }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{ cursor: string; node: { id: string; firstName: string } }>;
        pageInfo: {
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
      };
    };
    expect(data.users.edges.map((e) => e.node.id)).toEqual(['u-alice', 'u-bob']);
    expect(data.users.pageInfo.hasNextPage).toBe(false);
    expect(data.users.pageInfo.hasPreviousPage).toBe(false);
    expect(data.users.pageInfo.startCursor).toBeTruthy();
    expect(data.users.pageInfo.endCursor).toBeTruthy();
  });

  it('paginates forward with first + after', async () => {
    const page1 = await runQuery(`{
      posts(first: 2) {
        edges { cursor node { id } }
        pageInfo { hasNextPage endCursor }
      }
    }`);
    expect(page1.errors).toBeUndefined();
    const d1 = page1.data as {
      posts: {
        edges: Array<{ cursor: string; node: { id: string } }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
    expect(d1.posts.edges).toHaveLength(2);
    expect(d1.posts.pageInfo.hasNextPage).toBe(true);
    const cursor = d1.posts.pageInfo.endCursor!;

    const page2 = await runQuery(`{
      posts(first: 2, after: "${cursor}") {
        edges { cursor node { id } }
        pageInfo { hasNextPage hasPreviousPage }
      }
    }`);
    expect(page2.errors).toBeUndefined();
    const d2 = page2.data as {
      posts: {
        edges: Array<{ cursor: string; node: { id: string } }>;
        pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
      };
    };
    expect(d2.posts.edges).toHaveLength(2);
    expect(d2.posts.pageInfo.hasNextPage).toBe(false);
    expect(d2.posts.pageInfo.hasPreviousPage).toBe(true);

    const allIds = [...d1.posts.edges, ...d2.posts.edges].map((e) => e.node.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('hoists relatedConnection into the parent prismaField via include', async () => {
    const result = await runQuery(`{
      users(first: 10) {
        edges {
          node {
            id
            postsConnection(first: 1) {
              edges { cursor node { id } }
              pageInfo { hasNextPage }
            }
          }
        }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{
          node: {
            id: string;
            postsConnection: {
              edges: Array<{ cursor: string; node: { id: string } }>;
              pageInfo: { hasNextPage: boolean };
            };
          };
        }>;
      };
    };
    const alice = data.users.edges.find((e) => e.node.id === 'u-alice');
    expect(alice?.node.postsConnection.edges).toHaveLength(1);
    expect(alice?.node.postsConnection.pageInfo.hasNextPage).toBe(true);
  });

  it('prismaConnection totalCount accepts a callable form', async () => {
    const result = await runQuery(
      '{ usersWithCustomCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      usersWithCustomCount: { edges: Array<{ node: { id: string } }>; totalCount: number };
    };
    expect(data.usersWithCustomCount.edges).toHaveLength(1);
    expect(data.usersWithCustomCount.totalCount).toBe(42);
  });

  it('prismaConnection totalCount returns the count of the base collection', async () => {
    const result = await runQuery(
      '{ usersWithCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      usersWithCount: { edges: Array<{ node: { id: string } }>; totalCount: number };
    };
    expect(data.usersWithCount.edges).toHaveLength(1);
    expect(data.usersWithCount.totalCount).toBe(2);
  });

  it('two relatedConnection totalCount fields on the same relation get independent counts', async () => {
    const result = await runQuery(`{
      users(first: 10) {
        edges {
          node {
            id
            postsConnectionWithCount(first: 1) { totalCount edges { node { id } } }
            postsConnectionWithCountAlt(first: 1) { totalCount edges { node { id } } }
          }
        }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{
          node: {
            id: string;
            postsConnectionWithCount: { totalCount: number };
            postsConnectionWithCountAlt: { totalCount: number };
          };
        }>;
      };
    };
    const counts = Object.fromEntries(
      data.users.edges.map((e) => [
        e.node.id,
        {
          a: e.node.postsConnectionWithCount.totalCount,
          b: e.node.postsConnectionWithCountAlt.totalCount,
        },
      ]),
    );
    expect(counts).toEqual({
      'u-alice': { a: 2, b: 2 },
      'u-bob': { a: 2, b: 2 },
    });
  });

  it('relatedConnection totalCount returns the unpaginated count', async () => {
    const result = await runQuery(`{
      users(first: 10) {
        edges {
          node {
            id
            postsConnectionWithCount(first: 1) {
              edges { node { id } }
              totalCount
            }
          }
        }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{
          node: {
            id: string;
            postsConnectionWithCount: {
              edges: Array<{ node: { id: string } }>;
              totalCount: number;
            };
          };
        }>;
      };
    };
    const counts = Object.fromEntries(
      data.users.edges.map((e) => [e.node.id, e.node.postsConnectionWithCount.totalCount]),
    );
    expect(counts).toEqual({ 'u-alice': 2, 'u-bob': 2 });
  });

  it('paginates across all pages without duplicates or gaps', async () => {
    const allIds: string[] = [];
    let cursor: string | null = null;
    let hasNextPage = true;
    while (hasNextPage) {
      const afterClause: string = cursor ? `, after: "${cursor}"` : '';
      const result = await runQuery(`{
        posts(first: 1${afterClause}) {
          edges { cursor node { id } }
          pageInfo { hasNextPage endCursor }
        }
      }`);
      expect(result.errors).toBeUndefined();
      const data = result.data as {
        posts: {
          edges: Array<{ cursor: string; node: { id: string } }>;
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
        };
      };
      for (const edge of data.posts.edges) {
        allIds.push(edge.node.id);
      }
      hasNextPage = data.posts.pageInfo.hasNextPage;
      cursor = data.posts.pageInfo.endCursor;
    }
    expect(allIds.sort()).toEqual(['p-bob-draft', 'p-bob1', 'p-draft1', 'p-hello']);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('returns an empty page beyond the last cursor', async () => {
    const first = await runQuery(`{
      posts(first: 100) {
        edges { cursor }
        pageInfo { endCursor hasNextPage }
      }
    }`);
    const fd = first.data as {
      posts: {
        edges: Array<{ cursor: string }>;
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
      };
    };
    expect(fd.posts.pageInfo.hasNextPage).toBe(false);
    const lastCursor = fd.posts.pageInfo.endCursor!;

    const beyond = await runQuery(`{
      posts(first: 5, after: "${lastCursor}") {
        edges { cursor }
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      }
    }`);
    expect(beyond.errors).toBeUndefined();
    const bd = beyond.data as {
      posts: {
        edges: Array<{ cursor: string }>;
        pageInfo: {
          hasNextPage: boolean;
          hasPreviousPage: boolean;
          startCursor: string | null;
          endCursor: string | null;
        };
      };
    };
    expect(bd.posts.edges).toEqual([]);
    expect(bd.posts.pageInfo.hasNextPage).toBe(false);
    expect(bd.posts.pageInfo.startCursor).toBeNull();
    expect(bd.posts.pageInfo.endCursor).toBeNull();
  });

  it('paginates with a compound cursor (createdAt + id)', async () => {
    const page1 = await runQuery(`{
      postsByDate(first: 2) {
        edges { cursor node { id title } }
        pageInfo { hasNextPage endCursor }
      }
    }`);
    expect(page1.errors).toBeUndefined();
    const d1 = page1.data as {
      postsByDate: {
        edges: Array<{ cursor: string; node: { id: string } }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
    expect(d1.postsByDate.edges).toHaveLength(2);
    // Ordered by [createdAt, id]: seeded createdAt order is p-hello, p-draft1, p-bob1, p-bob-draft.
    expect(d1.postsByDate.edges.map((e) => e.node.id)).toEqual(['p-hello', 'p-draft1']);
    expect(d1.postsByDate.pageInfo.hasNextPage).toBe(true);
    const cursor = d1.postsByDate.pageInfo.endCursor!;

    const page2 = await runQuery(`{
      postsByDate(first: 2, after: "${cursor}") {
        edges { cursor node { id } }
        pageInfo { hasNextPage hasPreviousPage }
      }
    }`);
    expect(page2.errors).toBeUndefined();
    const d2 = page2.data as {
      postsByDate: {
        edges: Array<{ cursor: string; node: { id: string } }>;
        pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
      };
    };
    expect(d2.postsByDate.edges.map((e) => e.node.id)).toEqual(['p-bob1', 'p-bob-draft']);
    expect(d2.postsByDate.pageInfo.hasNextPage).toBe(false);
    expect(d2.postsByDate.pageInfo.hasPreviousPage).toBe(true);
  });

  it('prismaConnectionHelpers args accepts thunk form', async () => {
    const result = await runQuery(`{
      searchUsersThunk(first: 10, q: "Bob") {
        edges { node { id firstName } }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      searchUsersThunk: { edges: Array<{ node: { id: string; firstName: string } }> };
    };
    expect(data.searchUsersThunk.edges).toHaveLength(1);
    expect(data.searchUsersThunk.edges[0]!.node.firstName).toBe('Bob');
  });

  it('prismaConnectionHelpers + custom t.connection', async () => {
    const result = await runQuery(`{
      searchUsers(first: 10, search: "Alice") {
        edges { node { id firstName } }
        pageInfo { hasNextPage }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      searchUsers: {
        edges: Array<{ node: { id: string; firstName: string } }>;
        pageInfo: { hasNextPage: boolean };
      };
    };
    expect(data.searchUsers.edges).toHaveLength(1);
    expect(data.searchUsers.edges[0]!.node.firstName).toBe('Alice');
  });

  it('prismaNode — node(id) loads via the orm-client', async () => {
    const result = await runQuery(`{
      node(id: "${Buffer.from('Comment:c-1').toString('base64')}") {
        __typename
        ... on Comment { id body }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as { node: { __typename: string; id: string; body: string } | null };
    expect(data.node).toMatchObject({
      __typename: 'Comment',
      body: 'Looks great!',
    });
  });

  it('prismaNode — nested relations on node(id) preload via auto-include mapper', async () => {
    const result = await runQuery(`{
      node(id: "${Buffer.from('Comment:c-1').toString('base64')}") {
        __typename
        ... on Comment {
          body
          author { firstName }
        }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      node: { __typename: string; body: string; author: { firstName: string } } | null;
    };
    expect(data.node).toMatchObject({
      __typename: 'Comment',
      body: 'Looks great!',
      author: { firstName: 'Bob' },
    });
  });

  it('paginates backward with last + before', async () => {
    const result = await runQuery(`{
      posts(last: 2) {
        edges { cursor node { id } }
        pageInfo { hasNextPage hasPreviousPage }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      posts: {
        edges: Array<{ cursor: string; node: { id: string } }>;
        pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
      };
    };
    expect(data.posts.edges).toHaveLength(2);
    expect(data.posts.pageInfo.hasPreviousPage).toBe(true);
  });

  it('relatedConnection refine and totalCount stay in sync', async () => {
    const result = await runQuery(`{
      users(first: 10) {
        edges {
          node {
            id
            publishedPostsConnection(first: 10) {
              totalCount
              edges { node { id title published } }
            }
          }
        }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{
          node: {
            id: string;
            publishedPostsConnection: {
              totalCount: number;
              edges: Array<{ node: { id: string; published: number } }>;
            };
          };
        }>;
      };
    };
    const byId = Object.fromEntries(
      data.users.edges.map((e) => [e.node.id, e.node.publishedPostsConnection]),
    );
    expect(byId['u-alice']!.totalCount).toBe(1);
    expect(byId['u-alice']!.edges).toHaveLength(1);
    expect(byId['u-alice']!.edges[0]!.node.published).toBe(1);
    expect(byId['u-bob']!.totalCount).toBe(1);
    expect(byId['u-bob']!.edges).toHaveLength(1);
    expect(byId['u-bob']!.edges[0]!.node.published).toBe(1);
  });

  it('relatedConnection paginates backward with last + before', async () => {
    const result = await runQuery(`{
      users(first: 10) {
        edges {
          node {
            id
            postsConnection(last: 1) {
              edges { cursor node { id } }
              pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            }
          }
        }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{
          node: {
            id: string;
            postsConnection: {
              edges: Array<{ cursor: string; node: { id: string } }>;
              pageInfo: {
                hasNextPage: boolean;
                hasPreviousPage: boolean;
                startCursor: string | null;
                endCursor: string | null;
              };
            };
          };
        }>;
      };
    };
    const alice = data.users.edges.find((e) => e.node.id === 'u-alice')!;
    expect(alice.node.postsConnection.edges).toHaveLength(1);
    expect(alice.node.postsConnection.edges[0]!.node.id).toBe('p-hello');
    expect(alice.node.postsConnection.pageInfo.hasPreviousPage).toBe(true);
    expect(alice.node.postsConnection.pageInfo.hasNextPage).toBe(false);

    const cursor = alice.node.postsConnection.pageInfo.startCursor!;
    const back = await runQuery(`{
      users(first: 10) {
        edges {
          node {
            id
            postsConnection(last: 1, before: "${cursor}") {
              edges { node { id } }
              pageInfo { hasPreviousPage }
            }
          }
        }
      }
    }`);
    expect(back.errors).toBeUndefined();
    const bd = back.data as {
      users: {
        edges: Array<{
          node: {
            id: string;
            postsConnection: {
              edges: Array<{ node: { id: string } }>;
              pageInfo: { hasPreviousPage: boolean };
            };
          };
        }>;
      };
    };
    const aliceBack = bd.users.edges.find((e) => e.node.id === 'u-alice')!;
    expect(aliceBack.node.postsConnection.edges).toHaveLength(1);
    expect(aliceBack.node.postsConnection.edges[0]!.node.id).toBe('p-draft1');
    expect(aliceBack.node.postsConnection.pageInfo.hasPreviousPage).toBe(false);
  });

  it('Promise.allSettled: rows succeed + count rejects → count error surfaces', async () => {
    const result = await runQuery('{ usersCountRejects(first: 1) { totalCount } }');
    expect(result.errors?.[0]?.message ?? '').toMatch(/count-failed/);
  });

  it('prismaConnectionHelpers where: filters before pagination AND scopes totalCount', async () => {
    const result = await runQuery(
      '{ aliceOnly(first: 10) { edges { node { id firstName } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      aliceOnly: {
        edges: Array<{ node: { id: string; firstName: string } }>;
        totalCount: number;
      };
    };
    expect(data.aliceOnly.edges).toHaveLength(1);
    expect(data.aliceOnly.edges[0]!.node.firstName).toBe('Alice');
    expect(data.aliceOnly.totalCount).toBe(1);
  });

  it('prismaConnectionHelpers resolveNode: transforms each edge to the node shape', async () => {
    const result = await runQuery('{ namesOnly(first: 10) { edges { cursor node { id } } } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      namesOnly: { edges: Array<{ cursor: string; node: { id: string } }> };
    };
    // `resolveNode` drops `firstName`, so only `id` and the cursor are checked.
    expect(data.namesOnly.edges.length).toBeGreaterThan(0);
    for (const edge of data.namesOnly.edges) {
      expect(edge.cursor).toBeTruthy();
      expect(edge.node.id).toBeTruthy();
    }
  });

  it('prismaConnectionHelpers resolveNode: a wrapper node resolves through the wrapper', async () => {
    const result = await runQuery(
      '{ decoratedUsers(first: 10) { edges { cursor node { userId firstName decoratedAt } } } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      decoratedUsers: {
        edges: Array<{
          cursor: string;
          node: { userId: string; firstName: string; decoratedAt: string };
        }>;
      };
    };

    expect(data.decoratedUsers.edges).toHaveLength(2);
    expect(data.decoratedUsers.edges.map((edge) => edge.node.userId)).toEqual(['u-alice', 'u-bob']);
    for (const edge of data.decoratedUsers.edges) {
      expect(edge.node.userId).toBeTruthy();
      expect(edge.node.firstName).toBeTruthy();
      expect(edge.node.decoratedAt).toBe('decorated');
    }
  });

  it('prismaConnectionHelpers resolveNode: cursors still encode the original rows', async () => {
    const page1 = await runQuery(
      '{ decoratedUsers(first: 1) { pageInfo { endCursor hasNextPage } edges { cursor node { userId } } } }',
    );
    expect(page1.errors).toBeUndefined();
    const first = page1.data as {
      decoratedUsers: {
        pageInfo: { endCursor: string; hasNextPage: boolean };
        edges: Array<{ cursor: string; node: { userId: string } }>;
      };
    };

    expect(first.decoratedUsers.edges).toHaveLength(1);
    expect(first.decoratedUsers.edges[0]!.node.userId).toBe('u-alice');
    expect(first.decoratedUsers.edges[0]!.cursor).toBeTruthy();
    expect(first.decoratedUsers.edges[0]!.cursor).toBe(first.decoratedUsers.pageInfo.endCursor);
    expect(first.decoratedUsers.pageInfo.hasNextPage).toBe(true);

    const page2 = await runQuery(
      `{ decoratedUsers(first: 1, after: "${first.decoratedUsers.pageInfo.endCursor}") { edges { node { userId } } } }`,
    );
    expect(page2.errors).toBeUndefined();
    const second = page2.data as {
      decoratedUsers: { edges: Array<{ node: { userId: string } }> };
    };
    expect(second.decoratedUsers.edges).toHaveLength(1);
    expect(second.decoratedUsers.edges[0]!.node.userId).toBe('u-bob');
  });

  it('prismaConnectionHelpers resolveNode: an absent transform leaves the original row', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { contract: ctx.contract },
    });

    const off: boolean = false;
    const helper = prismaConnectionHelpers(builder, 'User', {
      cursor: 'id',
      resolveNode: off ? (row) => ({ user: row }) : undefined,
    });

    const page = await helper.applyPagination(ctx.ormClient.User, { first: 1 }, undefined, {});
    const node = page.wrap(await page.collection.all()).edges[0]!.node;

    expect('user' in node).toBe(false);
    if (!('user' in node)) {
      expect(node.id).toBe('u-alice');
    }
  });

  it('totalCount rejection does NOT crash queries that did not select totalCount', async () => {
    // The count promise is only built when `totalCount` is selected.
    const result = await runQuery('{ usersCountRejects(first: 1) { edges { node { id } } } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { usersCountRejects: { edges: Array<{ node: { id: string } }> } };
    expect(data.usersCountRejects.edges.length).toBeGreaterThan(0);
  });

  it('Promise.allSettled: rows reject + count succeeds → rows error wins', async () => {
    const result = await runQuery(
      '{ usersRowsRejectsAndCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors?.[0]?.message ?? '').toMatch(/rows-failed/);
  });

  it('Promise.allSettled: synchronously-throwing totalCount becomes a rejected promise', async () => {
    const result = await runQuery('{ usersCountSyncThrows(first: 1) { totalCount } }');
    expect(result.errors?.[0]?.message ?? '').toMatch(/sync-throw/);
  });

  it('prismaConnectionHelpers totalCount: true returns the aggregate count', async () => {
    const result = await runQuery(
      '{ searchUsersWithCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      searchUsersWithCount: { edges: Array<{ node: { id: string } }>; totalCount: number };
    };
    expect(data.searchUsersWithCount.edges).toHaveLength(1);
    expect(data.searchUsersWithCount.totalCount).toBe(2);
  });

  it('prismaConnectionHelpers totalCount: callable bypasses the aggregate', async () => {
    const result = await runQuery(
      '{ searchUsersCustomCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      searchUsersCustomCount: { edges: Array<{ node: { id: string } }>; totalCount: number };
    };
    expect(data.searchUsersCustomCount.totalCount).toBe(7);
  });

  it('prismaNode composite-ID resolves via node(id)', async () => {
    const composite = JSON.stringify(['u-alice', 'p-hello']);
    const globalId = Buffer.from(`PostByComposite:${composite}`).toString('base64');
    const result = await runQuery(`{
      node(id: "${globalId}") {
        __typename
        ... on PostByComposite { id title }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as { node: { __typename: string; title: string } | null };
    expect(data.node).toMatchObject({ __typename: 'PostByComposite', title: 'Hello, Pothos' });
  });

  it('prismaNode composite-ID rejects malformed global IDs (no client-payload echo)', async () => {
    const marker = 'XSS-PAYLOAD-MARKER-not-json';
    const garbage = Buffer.from(`PostByComposite:${marker}`).toString('base64');
    const result = await runQuery(`{
      node(id: "${garbage}") {
        __typename
        ... on PostByComposite { id }
      }
    }`);
    const msg = result.errors?.[0]?.message ?? '';
    expect(msg).toMatch(/ID payload is invalid/);
    expect(msg).not.toContain(marker);
  });

  it('prismaNode composite-ID rejects length-mismatched array', async () => {
    const wrong = JSON.stringify(['u-alice']);
    const globalId = Buffer.from(`PostByComposite:${wrong}`).toString('base64');
    const result = await runQuery(`{
      node(id: "${globalId}") {
        __typename
        ... on PostByComposite { id }
      }
    }`);
    expect(result.errors?.[0]?.message ?? '').toMatch(/expected 2 values, got 1/);
  });

  it('relatedConnection accepts a callable totalCount', async () => {
    const result = await runQuery(`{
      users(first: 10) {
        edges {
          node {
            id
            postsConnectionWithCallableCount(first: 1) {
              totalCount
              edges { node { id } }
            }
          }
        }
      }
    }`);
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: {
        edges: Array<{
          node: {
            id: string;
            postsConnectionWithCallableCount: {
              totalCount: number;
              edges: Array<{ node: { id: string } }>;
            };
          };
        }>;
      };
    };
    for (const e of data.users.edges) {
      expect(e.node.postsConnectionWithCallableCount.totalCount).toBe(999);
    }
  });
});

// `applyPagination` answers a promise when a `select` callback beneath the connection returned
// one; the helper resolves it, so the caller is handed a usable collection rather than a
// promise dressed as one.
describe('prismaConnectionHelpers with an async select beneath the connection', () => {
  it('hands back a usable collection', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin, RelayPlugin],
      relay: { clientMutationId: 'omit', cursorType: 'String' },
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', {
      fields: (t) => ({
        firstName: t.exposeString('firstName'),
        asyncName: t.string({
          select: (async () => ({ lastName: true })) as never,
          resolve: (parent) => (parent as { lastName?: string }).lastName ?? '',
        }),
      }),
    });
    const helpers = prismaConnectionHelpers(builder, 'User', { cursor: 'id' });
    builder.queryType({
      fields: (t) => ({
        users: t.connection({
          type: helpers.ref,
          args: helpers.getArgs(),
          resolve: async (_parent, args, context, info) => {
            const { collection, wrap } = await helpers.applyPagination(
              ctx.ormClient.User as never,
              args as never,
              info,
              context,
            );
            return wrap(await collection.all()) as never;
          },
        }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      contextValue: {},
      document: parse('{ users { edges { node { firstName asyncName } } } }'),
    });
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      users: { edges: Array<{ node: { firstName: string; asyncName: string } }> };
    };
    expect(data.users.edges[0]?.node).toEqual({ firstName: 'Alice', asyncName: 'Andrews' });
  });
});
