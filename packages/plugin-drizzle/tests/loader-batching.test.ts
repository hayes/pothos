import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import type { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import DrizzlePlugin from '../src';
import { ModelLoader } from '../src/model-loader';
import { clearDrizzleLogs, type DrizzleRelations, db, drizzleLogs, relations } from './example/db';

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
  DrizzleRelations: DrizzleRelations;
  Context: Context;
  AsyncSelections: true;
}>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin, 'batchAsyncArgs'],
  drizzle: {
    client: () => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
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

/** Called at each use, so every select is typed from a literal of its own. */
const postsSelect = () => ({
  with: {
    posts: { columns: { title: true as const }, limit: 2, orderBy: { postId: 'asc' as const } },
  },
});
const commentsSelect = () => ({
  with: {
    comments: { columns: { id: true as const }, limit: 1, orderBy: { id: 'asc' as const } },
  },
});

const Post = builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    id: t.exposeID('postId'),
    // Falls back per post row when the post was not loaded with the planned selection.
    commentIds: t.idList({
      select: commentsSelect(),
      resolve: (post) => post.comments.map((comment) => comment.id),
    }),
    asyncCommentIds: t.idList({
      select: async () => {
        await macrotask();

        return commentsSelect();
      },
      resolve: (post) => post.comments.map((comment) => comment.id),
    }),
  }),
});

const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id'),
    // A relation field, which can tell whether the row it is handed already holds its data.
    posts: t.relation('posts', {
      args: { limit: t.arg.int() },
      query: (args) => ({ limit: args.limit ?? 1, orderBy: { postId: 'asc' as const } }),
    }),
    // Every twin below plans the same query; only how long its select takes to settle differs.
    titles: t.stringList({
      select: postsSelect(),
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    titlesTwin: t.stringList({
      select: postsSelect(),
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    asyncTitles: t.stringList({
      select: async () => {
        await macrotask();

        return postsSelect();
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    asyncTitlesTwin: t.stringList({
      select: async () => {
        await macrotask();

        return postsSelect();
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // Awaits one microtask before returning its selection.
    shallowTitles: t.stringList({
      select: async () => {
        await microtasks(1);

        return postsSelect();
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // The same await as `shallowTitles`: the two settle in one microtask drain.
    shallowTitlesTwin: t.stringList({
      select: async () => {
        await microtasks(1);

        return postsSelect();
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // Awaits strictly more times than `shallowTitles` before returning the same selection.
    deepTitles: t.stringList({
      select: async () => {
        await microtasks(8);

        return postsSelect();
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
        with: {
          posts: {
            columns: { title: true },
            limit: args.limit ?? 2,
            orderBy: { postId: 'asc' as const },
          },
        },
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

        return {
          with: {
            posts: {
              columns: { title: true },
              limit: args.limit ?? 2,
              orderBy: { postId: 'asc' as const },
            },
          },
        };
      },
      resolve: (user) => user.posts.map((post) => post.title),
    }),
    // The raw posts the query loaded beside the row, handed on without a selection of their own,
    // so every post resolves its own fields through the loader.
    rawPosts: t.field({
      type: [Post],
      resolve: (user) => (user as { posts?: never[] }).posts ?? [],
    }),
  }),
});

// The same rows behind a field that returns each of them a different number of macrotasks later:
// the shape a batch cannot hold together, and the control the counts below are read against.
const StaggeredUser = builder.drizzleObject('users', {
  name: 'StaggeredUser',
  fields: (t) => ({
    staggeredSelf: t.field({
      type: User,
      resolve: async (user) => {
        // Two macrotasks apart, so the batch a row opens is always issued before the next row
        // arrives: nothing here can share a batch with anything else.
        for (let i = 0; i < ((Number(user.id) % ROWS) + 1) * 2; i += 1) {
          await macrotask();
        }

        return user as never;
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Rows fetched without the planned selection: every field with a `select` falls back.
    rawUsers: t.drizzleField({
      type: [User],
      resolve: () => db.query.users.findMany({ limit: ROWS, orderBy: { id: 'asc' } }),
    }),
    staggeredUsers: t.drizzleField({
      type: [StaggeredUser],
      resolve: () => db.query.users.findMany({ limit: ROWS, orderBy: { id: 'asc' } }),
    }),
    // The same rows with their posts loaded raw beside them, so the nested list resolves
    // synchronously and every post row falls back on its own fields.
    rawUsersWithPosts: t.drizzleField({
      type: [User],
      resolve: () =>
        db.query.users.findMany({
          limit: ROWS,
          orderBy: { id: 'asc' },
          with: { posts: { limit: 2, orderBy: { postId: 'asc' } } },
        }),
    }),
  }),
});

const schema = builder.toSchema();

interface Counted {
  /** Batches the loader opened. In drizzle a batch is exactly one `findMany ... in (...)`. */
  batches: number;
  /** Every statement the driver ran, the parent list's included. */
  statements: number;
  /** Loader statements: the parent list's is the first one every case issues. */
  loads: number;
}

async function count(document: DocumentNode): Promise<Counted> {
  const initLoad = vi.spyOn(ModelLoader.prototype, 'initLoad');

  clearDrizzleLogs();

  try {
    const result = await execute({ schema, document, contextValue: { user: { id: 1 } } });

    expect(result.errors).toBeUndefined();

    const statements = drizzleLogs.length;

    return { batches: initLoad.mock.calls.length, statements, loads: statements - 1 };
  } finally {
    clearDrizzleLogs();
    initLoad.mockRestore();
  }
}

describe('model loader batching under async selections', () => {
  it('issues a query per row when every row resolves on its own tick', async () => {
    // The positive control: rows deliberately spread across macrotasks cannot share a batch, and
    // the counts below are only worth reading because this one reports ROWS.
    const control = await count(
      gql`{ staggeredUsers { staggeredSelf { posts(limit: 1) { id } } } }`,
    );

    expect(control.batches).toBe(ROWS);
    expect(control.loads).toBe(ROWS);
  });

  it('loads a list of rows with a synchronous selection in one query', async () => {
    const sync = await count(gql`{ rawUsers { titles } }`);

    // One batch, one statement: drizzle loads a whole batch with a single `in (...)`.
    expect(sync).toMatchObject({ batches: 1, loads: 1, statements: 2 });
  });

  it('loads a list of rows with an async selection in the same one query', async () => {
    const sync = await count(gql`{ rawUsers { titles } }`);
    const async = await count(gql`{ rawUsers { titles: asyncTitles } }`);

    // The selection is planned once per `Type@path`, so every row of the list waits on the same
    // promise and resumes in the same drain: an await ahead of the select moves the whole list.
    expect(async).toEqual(sync);
    expect(async).toMatchObject({ batches: 1, loads: 1 });
  });

  it('loads two async selections that settle in one drain in one query', async () => {
    const sync = await count(gql`{ rawUsers { titles titlesTwin } }`);
    const async = await count(gql`{ rawUsers { shallowTitles shallowTitlesTwin } }`);

    expect(async).toEqual(sync);
    expect(async).toMatchObject({ batches: 1, loads: 1 });
  });

  it('loads two async selections that each await a macrotask in one query', async () => {
    const async = await count(gql`{ rawUsers { asyncTitles asyncTitlesTwin } }`);

    // The batch is issued on a timer of its own, registered after the timers the two selects are
    // waiting on, so both selects settle and stage before it fires.
    expect(async).toMatchObject({ batches: 1, loads: 1 });
  });

  it('loads two selects that await to different depths in one query', async () => {
    const uneven = await count(gql`{ rawUsers { shallowTitles deepTitles } }`);

    // The batch is issued on a macrotask, so a select that settles on a microtask joins it
    // whatever depth it awaited to.
    expect(uneven).toMatchObject({ batches: 1, loads: 1 });
  });

  it('opens a batch per settling tick, not per row, when a sync and an async field mix', async () => {
    const sync = await count(gql`{ rawUsers { titles titlesTwin } }`);
    const mixed = await count(gql`{ rawUsers { titles titlesTwin: asyncTitles } }`);

    expect(sync).toMatchObject({ batches: 1, loads: 1 });
    // The sync field opens its batch in the tick the rows resolved in, and the batch's own timer
    // fires before the async select's: the async field takes a second batch. Two queries, not
    // two per row — every row of a field is still in that field's one batch.
    expect(mixed).toMatchObject({ batches: 2, loads: 2 });
  });

  it('loads a nested list in one query for every row of every parent', async () => {
    const sync = await count(gql`{ rawUsersWithPosts { rawPosts { commentIds } } }`);
    const async = await count(
      gql`{ rawUsersWithPosts { rawPosts { commentIds: asyncCommentIds } } }`,
    );

    // Every post of every user shares one batch, sync or async: a list index contributes nothing
    // to the plan's cache key, so one plan settles for all of them at once.
    expect(sync).toMatchObject({ batches: 1, loads: 1 });
    expect(async).toMatchObject({ batches: 1, loads: 1 });
  });

  it('loads a list whose args are mapped asynchronously before the select in one query', async () => {
    const mapped = await count(gql`{ rawUsers { titles: mappedTitles } }`);
    const mappedAsync = await count(gql`{ rawUsers { titles: mappedAsyncTitles } }`);

    // The arg mappers of a field run once per row, but they are all started in the same tick and
    // all await the same shape, so the selects behind them still settle together.
    expect(mapped).toMatchObject({ batches: 1, loads: 1 });
    expect(mappedAsync).toMatchObject({ batches: 1, loads: 1 });
  });

  // Pins a defect, not the behaviour we want: the loader records the mapping of the field it
  // reloaded under the field's own key, and with nothing else claiming that key it lands in the
  // shared tier, where a sibling row that falls back later reads it as proof of being loaded. A
  // field that cannot check the row it was handed (any `select` that is not a relation) then
  // resolves against a row without its data. Nothing async about it — the rows only have to
  // arrive on separate ticks. The prisma loader records only the mappings beneath the field and
  // is unaffected. Delete `.fails` when the loader stops claiming the shared key.
  it.fails('reloads a sibling row that falls back after another row was loaded', async () => {
    await count(gql`{ staggeredUsers { staggeredSelf { titles } } }`);
  });
});
