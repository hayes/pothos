import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import type { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { ModelLoader } from '../src/model-loader';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// A plugin that maps a field's arguments asynchronously, as the validation plugin does.
class BatchAsyncArgsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
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
      batchAsyncArgs: BatchAsyncArgsPlugin<Types>;
    }
  }
}

SchemaBuilder.registerPlugin('batchAsyncArgs', BatchAsyncArgsPlugin);

interface Context {
  user: { id: number };
}

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: Context;
  AsyncSelections: true;
}>({
  plugins: [PrismaPlugin, RelayPlugin, 'batchAsyncArgs'],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

/** The number of parent rows every list case resolves: large enough that a per-row query shows. */
const ROWS = 20;

/** A macrotask boundary: the coarsest resume a selection can wait for. */
const macrotask = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

/** `count` microtask boundaries: the finest resume a selection can wait for. */
async function microtasks(count: number) {
  for (let i = 0; i < count; i += 1) {
    await Promise.resolve();
  }
}

const postsSelect = { select: { title: true }, take: 2, orderBy: { id: 'asc' as const } };
const commentsSelect = { select: { id: true }, take: 1, orderBy: { id: 'asc' as const } };

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // Falls back per post row when the post was not loaded with the planned selection.
    commentIds: t.idList({
      select: { comments: commentsSelect },
      resolve: (post) => post.comments.map((comment) => comment.id),
    }),
    asyncCommentIds: t.idList({
      select: async () => {
        await macrotask();

        return { comments: commentsSelect };
      },
      resolve: (post) => post.comments.map((comment) => comment.id),
    }),
  }),
});

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // Every twin below plans the same query; only how long its select takes to settle differs.
    titles: t.stringList({
      select: { posts: postsSelect },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    titlesTwin: t.stringList({
      select: { posts: postsSelect },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    asyncTitles: t.stringList({
      select: async () => {
        await macrotask();

        return { posts: postsSelect };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    asyncTitlesTwin: t.stringList({
      select: async () => {
        await macrotask();

        return { posts: postsSelect };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // Awaits one microtask before returning its selection.
    shallowTitles: t.stringList({
      select: async () => {
        await microtasks(1);

        return { posts: postsSelect };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // The same await as `shallowTitles`: the two settle in one microtask drain.
    shallowTitlesTwin: t.stringList({
      select: async () => {
        await microtasks(1);

        return { posts: postsSelect };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // Awaits strictly more times than `shallowTitles` before returning the same selection.
    deepTitles: t.stringList({
      select: async () => {
        await microtasks(8);

        return { posts: postsSelect };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // A synchronous select behind an async argument mapper, as the validation plugin makes.
    mappedTitles: t.stringList({
      args: { limit: t.arg.int() },
      extensions: {
        mapArgsAsync: async (args: { limit?: number | null }) => {
          await macrotask();

          return { limit: args.limit ?? 2 };
        },
      },
      select: (args: { limit?: number | null }) => ({
        posts: { ...postsSelect, take: args.limit ?? 2 },
      }),
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // An async select behind an async argument mapper.
    mappedAsyncTitles: t.stringList({
      args: { limit: t.arg.int() },
      extensions: {
        mapArgsAsync: async (args: { limit?: number | null }) => {
          await macrotask();

          return { limit: args.limit ?? 2 };
        },
      },
      select: async (args: { limit?: number | null }) => {
        await macrotask();

        return { posts: { ...postsSelect, take: args.limit ?? 2 } };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // The other fallback path: not the model loader, but a per-row resolver planned through
    // `fallbackQueryFromInfo`, whose plan memo is keyed the same way.
    publishedCount: t.relationCount('posts', { where: { published: true } }),
    asyncPublishedCount: t.relationCount('posts', {
      where: async () => {
        await macrotask();

        return { published: true };
      },
    }),
    // A relation with a `resolve` of its own: the only shape that reaches the fallback resolver,
    // which `fallbackQueryFromInfo` plans and which queries a row at a time.
    resolvedPosts: t.relation('posts', {
      query: { take: 1, orderBy: { id: 'asc' } },
      resolve: (query, user) => prisma.post.findMany({ ...query, where: { authorId: user.id } }),
    }),
    asyncResolvedPosts: t.relation('posts', {
      query: async () => {
        await macrotask();

        return { take: 1, orderBy: { id: 'asc' as const } };
      },
      resolve: (query, user) => prisma.post.findMany({ ...query, where: { authorId: user.id } }),
    }),
    // Planned through `fallbackQueryFromInfo` and resolved a row at a time, rather than through
    // the model loader.
    postsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: () => ({ orderBy: { id: 'asc' } }),
    }),
    asyncPostsConnection: t.relatedConnection('posts', {
      cursor: 'id',
      query: async () => {
        await macrotask();

        return { orderBy: { id: 'asc' as const } };
      },
    }),
    // The raw posts the query loaded beside the row, handed on without a selection of their own,
    // so every post resolves its own fields through the loader.
    rawPosts: t.field({
      type: [Post],
      resolve: (user) => (user as unknown as { posts?: never[] }).posts ?? [],
    }),
  }),
});

// A node whose custom `findUnique` builds its where from an ID the resolver settles later. The
// loader waits for that where inside the flush loop, after the batch it belongs to is closed.
const AsyncIdUser = builder.prismaNode('User', {
  variant: 'AsyncIdUser',
  id: {
    resolve: async (user) => {
      await macrotask();

      return String(user.id);
    },
  },
  findUnique: (id) => ({ id: Number(id) }),
  fields: (t) => ({
    titles: t.stringList({
      select: { posts: postsSelect },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
  }),
});

// The same node with the ID resolved in place: the counts the async one is read against.
const SyncIdUser = builder.prismaNode('User', {
  variant: 'SyncIdUser',
  id: { resolve: (user) => String(user.id) },
  findUnique: (id) => ({ id: Number(id) }),
  fields: (t) => ({
    titles: t.stringList({
      select: { posts: postsSelect },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
  }),
});

// The same rows behind a field that returns each of them a different number of macrotasks later:
// the shape a batch cannot hold together, and the control the counts below are read against.
const StaggeredUser = builder.prismaObject('User', {
  variant: 'StaggeredUser',
  fields: (t) => ({
    staggeredSelf: t.field({
      type: User,
      resolve: async (user) => {
        // Two macrotasks apart, so the batch a row opens is always issued before the next row
        // arrives: nothing here can share a batch with anything else.
        for (let i = 0; i < ((Number(user.id) % ROWS) + 1) * 2; i += 1) {
          await macrotask();
        }

        return user;
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Rows fetched without the planned selection: every field with a `select` falls back.
    rawUsers: t.field({
      type: [User],
      resolve: () => prisma.user.findMany({ take: ROWS, orderBy: { id: 'asc' } }),
    }),
    staggeredUsers: t.field({
      type: [StaggeredUser],
      resolve: () => prisma.user.findMany({ take: ROWS, orderBy: { id: 'asc' } }),
    }),
    rawAsyncIdUsers: t.field({
      type: [AsyncIdUser],
      resolve: () => prisma.user.findMany({ take: ROWS, orderBy: { id: 'asc' } }),
    }),
    rawSyncIdUsers: t.field({
      type: [SyncIdUser],
      resolve: () => prisma.user.findMany({ take: ROWS, orderBy: { id: 'asc' } }),
    }),
    // The same rows with their posts loaded raw beside them, so the nested list resolves
    // synchronously and every post row falls back on its own fields.
    rawUsersWithPosts: t.field({
      type: [User],
      resolve: () =>
        prisma.user.findMany({
          take: ROWS,
          orderBy: { id: 'asc' },
          include: { posts: { take: 2, orderBy: { id: 'asc' } } },
        }),
    }),
  }),
});

const schema = builder.toSchema();

interface Counted {
  /** Batches the loader opened: one merged node, and one query per row staged into it. */
  batches: number;
  /** Every query the client issued, the parent list's included. */
  actions: string[];
  /** Loader queries only, and the distinct selections they were issued with. */
  loads: number;
  selections: number;
}

async function count(document: DocumentNode): Promise<Counted> {
  const initLoad = vi.spyOn(ModelLoader.prototype, 'initLoad');

  queries.length = 0;

  let issued: { action: string; args: { include?: unknown } }[];
  let batches: number;

  try {
    const result = await execute({ schema, document, contextValue: { user: { id: 1 } } });

    expect(result.errors).toBeUndefined();

    issued = [...queries] as typeof issued;
    batches = initLoad.mock.calls.length;
  } finally {
    // Restored even when the assertion above throws: a spy left installed counts the next test's
    // batches too, turning one failure into a cascade of unrelated ones.
    queries.length = 0;
    initLoad.mockRestore();
  }

  const loads = issued.filter((query) => query.action !== 'findMany');

  return {
    batches,
    actions: issued.map((query) => query.action),
    loads: loads.length,
    selections: new Set(loads.map((query) => JSON.stringify(query.args.include))).size,
  };
}

describe('model loader batching under async selections', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('counts a batch per row when every row resolves on its own tick', async () => {
    // The positive control: rows deliberately spread across macrotasks cannot share a batch, and
    // the counts below are only worth reading because this one reports ROWS.
    const control = await count(gql`{ staggeredUsers { staggeredSelf { titles } } }`);

    expect(control.batches).toBe(ROWS);
    expect(control.loads).toBe(ROWS);
  });

  it('batches a list of rows with a synchronous selection', async () => {
    const sync = await count(gql`{ rawUsers { titles } }`);

    // One batch, one merged selection, and prisma's one findUnique per row inside it: the batch
    // merges what the rows select, not the round trips they take.
    expect(sync).toMatchObject({ batches: 1, loads: ROWS, selections: 1 });
    expect(sync.actions[0]).toBe('findMany');
  });

  it('batches a list of rows with an async selection exactly as the sync one', async () => {
    const sync = await count(gql`{ rawUsers { titles } }`);
    const async = await count(gql`{ rawUsers { titles: asyncTitles } }`);

    // The selection is planned once per `Type@path`, so every row of the list waits on the same
    // promise and resumes in the same drain: an await ahead of the select moves the whole list.
    expect(async.batches).toBe(sync.batches);
    expect(async.loads).toBe(sync.loads);
    expect(async).toMatchObject({ batches: 1, loads: ROWS, selections: 1 });
  });

  it('batches a list of rows whose node IDs resolve asynchronously', async () => {
    const sync = await count(gql`{ rawSyncIdUsers { titles } }`);
    const async = await count(gql`{ rawAsyncIdUsers { titles } }`);

    // The where each row's `findUnique` builds is awaited inside the flush loop, after
    // `stageQuery` has already decided which batch the row belongs to — so an async ID costs the
    // same one batch and the same one merged selection a synchronous one does. `loads` stays ROWS
    // in both: the batch merges what the rows select, not the round trips they take.
    expect(sync).toMatchObject({ batches: 1, loads: ROWS, selections: 1 });
    expect(async).toMatchObject({ batches: 1, loads: ROWS, selections: 1 });
    expect(async.selections).toBe(sync.selections);
  });

  it('batches two async selections that settle in one drain', async () => {
    const sync = await count(gql`{ rawUsers { titles titlesTwin } }`);
    const async = await count(gql`{ rawUsers { shallowTitles shallowTitlesTwin } }`);

    // Both fields await the same number of microtasks, so both stage before the batch is issued.
    expect(async).toMatchObject({ batches: sync.batches, loads: sync.loads });
    expect(async).toMatchObject({ batches: 1, loads: ROWS });
  });

  it('opens a batch per settling tick, not per row, when a sync and an async field mix', async () => {
    const sync = await count(gql`{ rawUsers { titles titlesTwin } }`);
    const mixed = await count(gql`{ rawUsers { titles titlesTwin: asyncTitles } }`);

    expect(sync).toMatchObject({ batches: 1, loads: ROWS });
    // The sync field stages in the tick the rows resolved in and the async one a tick later, so
    // the two fields take a batch each. Two batches, not two per row: every row of a field is
    // still in that field's one batch.
    expect(mixed).toMatchObject({ batches: 2, loads: 2 * ROWS });
  });

  it('opens a batch per settling tick when two selects await to different depths', async () => {
    const even = await count(gql`{ rawUsers { shallowTitles shallowTitlesTwin } }`);
    const uneven = await count(gql`{ rawUsers { shallowTitles deepTitles } }`);
    const separate = await count(gql`{ rawUsers { asyncTitles asyncTitlesTwin } }`);

    expect(even).toMatchObject({ batches: 1, loads: ROWS });
    // The depth of the await moves the field between batches, never the rows within it: both
    // shapes cost one batch per settling tick whatever ROWS is.
    expect(uneven).toMatchObject({ batches: 2, loads: 2 * ROWS });
    expect(separate).toMatchObject({ batches: 2, loads: 2 * ROWS });
  });

  it('batches a nested list once for every row of every parent', async () => {
    const sync = await count(gql`{ rawUsersWithPosts { rawPosts { commentIds } } }`);
    const async = await count(
      gql`{ rawUsersWithPosts { rawPosts { commentIds: asyncCommentIds } } }`,
    );

    // Every post of every user shares one batch, sync or async: a list index contributes nothing
    // to the plan's cache key, so one plan settles for all of them at once.
    expect(sync).toMatchObject({ batches: 1, selections: 1 });
    expect(async).toMatchObject({ batches: 1, selections: 1 });
    expect(async.loads).toBe(sync.loads);
    expect(sync.loads).toBe(2 * ROWS);
  });

  it('batches a list whose args are mapped asynchronously before the select', async () => {
    const mapped = await count(gql`{ rawUsers { titles: mappedTitles } }`);
    const mappedAsync = await count(gql`{ rawUsers { titles: mappedAsyncTitles } }`);

    // The arg mappers of a field run once per row, but they are all started in the same tick and
    // all await the same shape, so the selects behind them still settle together.
    expect(mapped).toMatchObject({ batches: 1, loads: ROWS, selections: 1 });
    expect(mappedAsync).toMatchObject({ batches: 1, loads: ROWS, selections: 1 });
  });

  it('reloads a sibling row that falls back after another row was loaded', async () => {
    // The contrast to the drizzle loader, which records the reloaded field's own mapping in the
    // shared tier and lets a later sibling read it as proof of being loaded: this loader records
    // only the mappings beneath the field, so every row of the list reloads for itself.
    const staggered = await count(gql`{ staggeredUsers { staggeredSelf { titles } } }`);

    expect(staggered.loads).toBe(ROWS);
  });

  it('batches a related count and a related connection on a raw row like any other select', async () => {
    const count1 = await count(gql`{ rawUsers { publishedCount } }`);
    const count2 = await count(gql`{ rawUsers { publishedCount: asyncPublishedCount } }`);
    const conn1 = await count(
      gql`{ rawUsers { postsConnection(first: 1) { edges { node { id } } } } }`,
    );
    const conn2 = await count(
      gql`{ rawUsers { postsConnection: asyncPostsConnection(first: 1) { edges { node { id } } } } }`,
    );

    // A count and a connection with no `resolve` of their own are loaded by the model loader, so
    // an async `where` or `query` costs nothing over the sync one.
    expect(count2).toEqual(count1);
    expect(conn2).toEqual(conn1);
    expect(count1).toMatchObject({ batches: 1, loads: ROWS });
    expect(conn1).toMatchObject({ batches: 1, loads: ROWS });
  });

  it('queries a row at a time on the fallback resolver path, async or not', async () => {
    const sync = await count(gql`{ rawUsers { resolvedPosts { id } } }`);
    const async = await count(gql`{ rawUsers { resolvedPosts: asyncResolvedPosts { id } } }`);

    // A relation with a `resolve` of its own never reaches the model loader: `wrapResolve` plans
    // it with `fallbackQueryFromInfo` and hands the query to the resolver, which runs per row.
    // The plan memo that keyed on `Type@path` saves ROWS - 1 plans, never a query, so this path
    // costs ROWS queries whether the relation's `query` is async or not.
    expect(async.actions).toEqual(sync.actions);
    expect(sync.batches).toBe(0);
    expect(sync.actions).toHaveLength(ROWS + 1);
  });
});
