import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
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
      // Same connection but with totalCount enabled — exercises the
      // mapper's synthetic count branch + connection-options wrapping.
      postsConnectionWithCount: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
      }),
      // Second totalCount-bearing connection on the same relation. Both
      // fields must end up with independent count aliases under the
      // parent's combine spec — keying by relation name alone would
      // collide and clobber one of the counts.
      postsConnectionWithCountAlt: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
      }),
      // Refined + totalCount on the same field. The synthetic count
      // branch must apply the same `refine` as the paginated branch
      // so the count reflects the filtered set, not the unfiltered
      // relation. (F7)
      publishedPostsConnection: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
        where: { published: 1 },
      }),
      // Callable totalCount on relatedConnection — skips the synthetic
      // include count and asks the resolver. (E4)
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

  // prismaNode — register Comment as a Relay Node so node(id) works.
  // Plugin owns the id-predicate / `apply` / `.all()` chain; the user
  // just declares the base collection accessor.
  builder.prismaNode('Comment', {
    id: { field: 'id' },
    collection: ctx.ormClient.Comment,
    fields: (t) => ({
      body: t.exposeString('body'),
      author: t.relation('author'),
    }),
  });

  // Composite-ID prismaNode — Post registered under a variant name so
  // it doesn't conflict with the regular Post type already registered
  // elsewhere. The id is a tuple `[authorId, id]` — JSON-encoded as a
  // global ID; plugin decodes the tuple and builds the OR-of-AND-of-eq
  // predicate internally so the user supplies just the model accessor.
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

  // prismaConnectionHelpers — used below in a custom t.connection field
  // to prove the escape-hatch API works end-to-end.
  const userSearch = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
  });

  // Helper with `totalCount: true` (auto-aggregate) — tests the
  // totalCountPromise + connectionOptions wrapper on the helper API.
  const userSearchWithCount = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    totalCount: true,
  });

  // Helper with `totalCount: callable` — bypasses the aggregate; the
  // resolver supplies the count directly.
  const userSearchCustomCount = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    totalCount: () => 7,
  });

  // Helper with `where` (pre-pagination filter) — R3 parity addition.
  // Filters to Alice's row before pagination + count.
  const aliceOnly = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    where: (u) => u.firstName.eq('Alice'),
    totalCount: true,
  });

  // Helper with `resolveNode` (edge → node transform) — R3 parity addition.
  // Transforms the User row to a stripped-down "name only" shape.
  const namesOnly = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    resolveNode: (edge) => ({ id: edge.id, name: edge.firstName }),
  });

  // Thunk form for `args` — closes over the InputFieldBuilder lazily.
  // Used to exercise C8.
  const userSearchThunkArgs = prismaConnectionHelpers(builder, 'User', {
    cursor: 'id',
    defaultSize: 10,
    args: (t) => ({ q: t.string({ required: true }) }),
  });

  builder.queryType({
    fields: (t) => ({
      // Custom t.connection using the helpers — adds a `search` arg
      // and filters on firstName before applying pagination.
      searchUsers: t.connection({
        type: userSearch.ref,
        args: { ...userSearch.getArgs(), search: t.arg.string({ required: true }) },
        resolve: async (_parent, args, _ctx, info) => {
          const { collection, wrap } = userSearch.applyPagination(
            ctx.ormClient.User,
            args,
            info,
            _ctx,
          );
          const rows = await collection.where((u) => u.firstName.eq(args.search)).all();
          return wrap(rows) as never;
        },
      }),
      // Helper-with-totalCount (auto-aggregate) — tests
      // totalCountPromise + helper.connectionOptions(...) wrapping.
      searchUsersWithCount: t.connection(
        {
          type: userSearchWithCount.ref,
          args: userSearchWithCount.getArgs(),
          resolve: async (_parent, args, _ctx, info) => {
            const { collection, wrap, totalCountPromise } = userSearchWithCount.applyPagination(
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
        userSearchWithCount.connectionOptions({}),
      ),
      // Helper `query` option — pre-pagination filter applied to the
      // base collection. totalCount uses the filtered base so the
      // count matches the page rows.
      aliceOnly: t.connection(
        {
          type: aliceOnly.ref,
          args: aliceOnly.getArgs(),
          resolve: async (_p, args, _ctx, info) => {
            const { collection, wrap, totalCountPromise } = aliceOnly.applyPagination(
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
      // Helper `resolveNode` option — transform edges.
      namesOnly: t.connection({
        type: namesOnly.ref,
        args: namesOnly.getArgs(),
        resolve: async (_p, args, _ctx, info) => {
          const { collection, wrap } = namesOnly.applyPagination(
            ctx.ormClient.User,
            args,
            info,
            _ctx,
          );
          const rows = await collection.all();
          return wrap(rows) as never;
        },
      }),
      // Helper-with-callable-totalCount — exercises the callback path
      // (skips the aggregate).
      searchUsersCustomCount: t.connection(
        {
          type: userSearchCustomCount.ref,
          args: userSearchCustomCount.getArgs(),
          resolve: async (_parent, args, _ctx, info) => {
            const { collection, wrap, totalCountPromise } = userSearchCustomCount.applyPagination(
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
        userSearchCustomCount.connectionOptions({}),
      ),
      // Exercises the thunk-form args from C8.
      searchUsersThunk: t.connection({
        type: userSearchThunkArgs.ref,
        args: userSearchThunkArgs.getArgs(),
        resolve: async (_parent, args, _ctx, info) => {
          const { collection, wrap } = userSearchThunkArgs.applyPagination(
            ctx.ormClient.User,
            args,
            info,
            _ctx,
          );
          const rows = await collection.where((u) => u.firstName.eq(args.q)).all();
          return wrap(rows) as never;
        },
      }),
      users: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        maxSize: 100,
        resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User)) as never,
      }),
      usersWithCount: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: true,
        resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User)) as never,
      }),
      // Callable totalCount — skips the auto-aggregate and returns the
      // count directly. Use case: count comes from a cache or
      // denormalized counter, or needs custom filtering the auto path
      // can't capture.
      usersWithCustomCount: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: () => 42,
        resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User)) as never,
      }),
      // Promise.allSettled races: rows succeed + count rejects → the
      // count error surfaces (rather than being silently swallowed).
      usersCountRejects: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: () => Promise.reject(new Error('count-failed')),
        resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User)) as never,
      }),
      // Rows reject + count succeeds → the rows error wins the tie
      // (and the count promise rejection — if it were rejection — is
      // not reported as unhandled).
      usersRowsRejectsAndCount: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: () => 9,
        resolve: (() => Promise.reject(new Error('rows-failed'))) as never,
      }),
      // Synchronously-throwing totalCount callback — wrapped in
      // `Promise.resolve().then(...)` deferred construction so the
      // throw becomes a rejected promise (not a sync bubble that
      // escapes the resolver shape).
      usersCountSyncThrows: t.prismaConnection({
        type: 'User',
        cursor: 'id',
        defaultSize: 10,
        totalCount: (() => {
          throw new Error('sync-throw');
        }) as never,
        resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.User)) as never,
      }),
      posts: t.prismaConnection({
        type: 'Post',
        cursor: 'id',
        resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.Post)) as never,
      }),
      // Compound cursor — sorted by createdAt then id (id breaks ties).
      postsByDate: t.prismaConnection({
        type: 'Post',
        cursor: ['createdAt', 'id'],
        resolve: ((apply: <C>(c: C) => C) => apply(ctx.ormClient.Post)) as never,
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
    // Posts has 4 rows. Page 1: take 2.
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

    // Page 2: take 2 starting after page 1's last cursor.
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

    // Verify no duplicate IDs across pages.
    const allIds = [...d1.posts.edges, ...d2.posts.edges].map((e) => e.node.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('hoists relatedConnection into the parent prismaField via include', async () => {
    // Per-user paginated posts via t.relatedConnection. The mapper
    // emits .include('posts', cb => cb.orderBy(id).take(N+1)) on the
    // User collection so this still resolves in one query (modulo
    // upstream multi-query fallback for include refinements).
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
    // Alice has 2 posts; first: 1 → 1 edge, hasNextPage: true.
    expect(alice?.node.postsConnection.edges).toHaveLength(1);
    expect(alice?.node.postsConnection.pageInfo.hasNextPage).toBe(true);
  });

  it('prismaConnection totalCount accepts a callable form (C1)', async () => {
    const result = await runQuery(
      '{ usersWithCustomCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      usersWithCustomCount: { edges: Array<{ node: { id: string } }>; totalCount: number };
    };
    expect(data.usersWithCustomCount.edges).toHaveLength(1);
    // Callable returned 42 — bypasses the auto-aggregate.
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
    // 2 users seeded, only 1 fetched via first: 1 — totalCount stays 2.
    expect(data.usersWithCount.edges).toHaveLength(1);
    expect(data.usersWithCount.totalCount).toBe(2);
  });

  it('two relatedConnection totalCount fields on the same relation get independent counts (A4)', async () => {
    // Old keying was `__pn_totalCount_<relationName>`, so two fields
    // both targeting `posts` collided and one's count clobbered the
    // other. Now each field claims a uniquely-suffixed alias.
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
    // Both totalCounts should report 2 for each user — same relation,
    // independent aliases, no clobber.
    expect(counts).toEqual({
      'u-alice': { a: 2, b: 2 },
      'u-bob': { a: 2, b: 2 },
    });
  });

  it('relatedConnection totalCount returns the unpaginated count', async () => {
    // Alice has 2 posts total — totalCount should report 2 even
    // though we only fetch the first edge.
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
    // Walk the entire posts list one row at a time and confirm we
    // visit each post exactly once.
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
    // First page of size 100 — gets all 4 posts.
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

    // Page beyond — should be empty with hasNextPage false.
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
    // Page 1.
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
    // Posts seeded with createdAt 04-01..04-04 in order p-hello, p-draft1,
    // p-bob1, p-bob-draft. With cursor=[createdAt, id] ASC the first
    // two should be p-hello, p-draft1.
    expect(d1.postsByDate.edges.map((e) => e.node.id)).toEqual(['p-hello', 'p-draft1']);
    expect(d1.postsByDate.pageInfo.hasNextPage).toBe(true);
    const cursor = d1.postsByDate.pageInfo.endCursor!;

    // Page 2.
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

  it('prismaConnectionHelpers args accepts thunk form (C8)', async () => {
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
    // First fetch a comment via the standard relay node() field.
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
    // Without info-threaded loadWithoutCache, asking for a nested relation
    // here would throw "reached from a parent not loaded by t.prismaField".
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
    // Get the last 2 posts.
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
    // hasPreviousPage true since we're at the end and there are more before.
    expect(data.posts.pageInfo.hasPreviousPage).toBe(true);
  });

  it('relatedConnection refine and totalCount stay in sync (F7)', async () => {
    // Alice has 2 posts seeded (`p-hello` published, `p-draft1` not).
    // `publishedPostsConnection.query: { where: { published: 1 } }`
    // narrows both branches. totalCount must reflect the FILTERED set —
    // i.e. 1, not 2 — otherwise the count and the edges disagree.
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
    // Alice: 1 published post. Both edges.length and totalCount must agree.
    expect(byId['u-alice']!.totalCount).toBe(1);
    expect(byId['u-alice']!.edges).toHaveLength(1);
    expect(byId['u-alice']!.edges[0]!.node.published).toBe(1);
    // Bob: 1 published post.
    expect(byId['u-bob']!.totalCount).toBe(1);
    expect(byId['u-bob']!.edges).toHaveLength(1);
    expect(byId['u-bob']!.edges[0]!.node.published).toBe(1);
  });

  it('relatedConnection paginates backward with last + before (F8)', async () => {
    // Backward pagination on a relatedConnection exercises the cursor
    // `lt` branch in `buildLexicographicPredicate` — previously a dead
    // code path (B4). The query asks for `last: 1` on Alice's posts;
    // the include's cursor predicate must filter to the last row
    // (highest id) and pageInfo must report hasPreviousPage.
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
    // Alice has 2 posts (ids: p-draft1, p-hello). last: 1 → 1 edge,
    // the lexicographically highest id (`p-hello`).
    expect(alice.node.postsConnection.edges).toHaveLength(1);
    expect(alice.node.postsConnection.edges[0]!.node.id).toBe('p-hello');
    expect(alice.node.postsConnection.pageInfo.hasPreviousPage).toBe(true);
    expect(alice.node.postsConnection.pageInfo.hasNextPage).toBe(false);

    // Page back via before to verify the cursor `lt` predicate is sound.
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
    // The post BEFORE `p-hello` is `p-draft1` (lexicographic order).
    expect(aliceBack.node.postsConnection.edges).toHaveLength(1);
    expect(aliceBack.node.postsConnection.edges[0]!.node.id).toBe('p-draft1');
    expect(aliceBack.node.postsConnection.pageInfo.hasPreviousPage).toBe(false);
  });

  it('Promise.allSettled: rows succeed + count rejects → count error surfaces', async () => {
    const result = await runQuery('{ usersCountRejects(first: 1) { totalCount } }');
    expect(result.errors?.[0]?.message ?? '').toMatch(/count-failed/);
  });

  it('prismaConnectionHelpers where: filters before pagination AND scopes totalCount (R3)', async () => {
    // `where` runs as a pre-pagination filter; `totalCount: true`
    // uses the filtered base, so totalCount reports 1 (Alice) not 2.
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

  it('prismaConnectionHelpers resolveNode: transforms each edge to the node shape (R3)', async () => {
    // `resolveNode: (edge) => ({ id, name })` exposes a stripped
    // shape. The cursor still encodes the original row columns so
    // pagination remains stable.
    const result = await runQuery('{ namesOnly(first: 10) { edges { cursor node { id } } } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      namesOnly: { edges: Array<{ cursor: string; node: { id: string } }> };
    };
    // The shape carries `name`, not `firstName` — but the connection
    // type's `node` is `User`, so we only assert the `id` flows
    // through. The pre-transform cursor still works (non-empty).
    expect(data.namesOnly.edges.length).toBeGreaterThan(0);
    for (const edge of data.namesOnly.edges) {
      expect(edge.cursor).toBeTruthy();
      expect(edge.node.id).toBeTruthy();
    }
  });

  it('totalCount rejection does NOT crash queries that did not select totalCount (R3-P0-1)', async () => {
    // Round-3 fix: the count promise is only built when `totalCount`
    // is in the selection set. Without this gate, a `totalCount` that
    // rejects intermittently (cache misses, etc.) would crash every
    // query against the connection — even ones that just read edges.
    const result = await runQuery('{ usersCountRejects(first: 1) { edges { node { id } } } }');
    expect(result.errors).toBeUndefined();
    const data = result.data as { usersCountRejects: { edges: Array<{ node: { id: string } }> } };
    expect(data.usersCountRejects.edges.length).toBeGreaterThan(0);
  });

  it('Promise.allSettled: rows reject + count succeeds → rows error wins', async () => {
    // Even though `totalCount: () => 9` resolves, the rows rejection
    // is what GraphQL sees. The count promise's resolution has a
    // noop tap so it doesn't become an unhandledRejection.
    const result = await runQuery(
      '{ usersRowsRejectsAndCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors?.[0]?.message ?? '').toMatch(/rows-failed/);
  });

  it('Promise.allSettled: synchronously-throwing totalCount becomes a rejected promise', async () => {
    // `totalCount: () => { throw }` is wrapped in
    // `Promise.resolve().then(() => callback())` deferred-construction
    // so the throw turns into a rejected promise that
    // `Promise.allSettled` can observe. Without that wrapping, the
    // throw would bubble out of resolver construction.
    const result = await runQuery('{ usersCountSyncThrows(first: 1) { totalCount } }');
    expect(result.errors?.[0]?.message ?? '').toMatch(/sync-throw/);
  });

  it('prismaConnectionHelpers totalCount: true returns the aggregate count (D5)', async () => {
    const result = await runQuery(
      '{ searchUsersWithCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      searchUsersWithCount: { edges: Array<{ node: { id: string } }>; totalCount: number };
    };
    expect(data.searchUsersWithCount.edges).toHaveLength(1);
    // 2 users seeded; first: 1 → edges.length=1, totalCount stays 2.
    expect(data.searchUsersWithCount.totalCount).toBe(2);
  });

  it('prismaConnectionHelpers totalCount: callable bypasses the aggregate (D5)', async () => {
    const result = await runQuery(
      '{ searchUsersCustomCount(first: 1) { edges { node { id } } totalCount } }',
    );
    expect(result.errors).toBeUndefined();
    const data = result.data as {
      searchUsersCustomCount: { edges: Array<{ node: { id: string } }>; totalCount: number };
    };
    // Callback returned 7 — proves the aggregate path was skipped.
    expect(data.searchUsersCustomCount.totalCount).toBe(7);
  });

  it('prismaNode composite-ID resolves via node(id) (E3)', async () => {
    // Composite ID encoded as a JSON-array global ID. `parse` decodes
    // the string; loadWithoutCache builds `AND(authorId.eq(a), id.eq(b))`.
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
    // Garbage payload → wrapped as PothosValidationError. The error
    // message must NOT echo the client-supplied payload (log-aggregation
    // hygiene, parallel to decodeCursor's posture).
    const marker = 'XSS-PAYLOAD-MARKER-not-json';
    const garbage = Buffer.from(`PostByComposite:${marker}`).toString('base64');
    const result = await runQuery(`{
      node(id: "${garbage}") {
        __typename
        ... on PostByComposite { id }
      }
    }`);
    const msg = result.errors?.[0]?.message ?? '';
    expect(msg).toMatch(/composite ID is not a valid JSON array/);
    expect(msg).not.toContain(marker);
  });

  it('prismaNode composite-ID rejects length-mismatched array', async () => {
    // Composite expects 2 elements; pass 1.
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

  it('relatedConnection accepts a callable totalCount (E4)', async () => {
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
    // Callable returned 999 for both users — bypasses any aggregate.
    for (const e of data.users.edges) {
      expect(e.node.postsConnectionWithCallableCount.totalCount).toBe(999);
    }
  });
});
