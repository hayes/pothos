import { completeValue, isThenable } from '@pothos/core';
import type { GraphQLObjectType } from 'graphql';
import { describe, expect, it } from 'vitest';
import type { Adapter, SelectFn } from '../src';
import {
  getLoaderMapping,
  planFromInfo,
  play,
  queryFromInfo,
  queryFromPlan,
  rowPlanFromInfo,
} from '../src';
import { type FakeMap, type FakeModel, mappingOf, mappingsOf, resolveInfo } from './fake-adapter';
import { countPromises } from './promise-spy';
import { createTestAdapter, createTestSchema } from './schema';

const schema = createTestSchema();
const adapter = createTestAdapter();

type Select = SelectFn<FakeMap>;
type Args = Record<string, unknown>;
type Wrap = (select: Select, field: string) => Select;

function pathOf(...keys: (string | number)[]) {
  let path: { prev: unknown; key: string | number; typename: undefined } | undefined;

  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }

  return path as never;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The test adapter with the select functions of `fields` wrapped by `wrap`. */
function withSelects(fields: string[], wrap: Wrap): Adapter<FakeModel, FakeMap> {
  const wrapped = createTestAdapter();
  const { fieldSelection } = wrapped;

  wrapped.fieldSelection = (field, type) => {
    const selection = fieldSelection(field, type);

    return typeof selection === 'function' && fields.includes(field.name)
      ? wrap(selection, field.name)
      : selection;
  };

  return wrapped;
}

const takeQuery = (args: Args): FakeMap => (args.take === undefined ? {} : { take: args.take });
const whereXQuery = (args: Args): FakeMap => (args.x === undefined ? {} : { where: { x: args.x } });

/** An async `t.relation`-style select: it awaits its nested selection (A-6). */
const asyncRelation =
  (query?: (args: Args) => FakeMap, delay = 0): Wrap =>
  (_select, name) =>
  async (args, _ctx, nested) => {
    if (delay) {
      await sleep(delay);
    }

    return { select: { [name]: await nested(query?.(args as Args) ?? {}) } };
  };

/** A plugin-owned relation select: sync unless the nested selection is a promise. */
const pluginRelation =
  (query?: (args: Args) => FakeMap): Wrap =>
  (_select, name) =>
  (args, _ctx, nested) =>
    completeValue(nested(query?.(args as Args) ?? {}), (map) => ({ select: { [name]: map } }));

/** The field's own select, made async. */
const deferred: Wrap = (select) => async (args, ctx, nested, getNode, extra) => {
  await sleep(1);

  return select(args, ctx, nested, getNode, extra);
};

function withWraps(wraps: Record<string, Wrap>) {
  return withSelects(Object.keys(wraps), (select, name) => wraps[name](select, name));
}

async function sameAs(
  source: string,
  async: Adapter<FakeModel, FakeMap>,
  keys: [string, (string | number)[]][],
) {
  const info = await resolveInfo(schema, source);
  const syncContext = {};
  const expected = queryFromInfo(adapter, { context: syncContext, info });
  const context = {};
  const result = queryFromInfo(async, { context, info });

  expect(isThenable(result)).toBe(true);

  // L-2: nothing is recorded until every pending merge has run.
  for (const [type, path] of keys) {
    expect(getLoaderMapping(context, pathOf(...path), type)).toBe(null);
  }

  expect(await result).toEqual(expected);

  for (const [type, path] of keys) {
    // Positions aside: a key accepted from two occurrences records the position of whichever was
    // accepted first, which the async plan may reach in the other order.
    expect(mappingOf(getLoaderMapping(context, pathOf(...path), type))).toEqual(
      mappingOf(getLoaderMapping(syncContext, pathOf(...path), type)),
    );
  }
}

describe('async callbacks', () => {
  it('awaits an async select and builds the query the sync select builds', async () => {
    await sameAs(
      '{ user { id posts(take: 2) { id author(x: 1) { name } } profile { bio } } }',
      withWraps({
        posts: asyncRelation(takeQuery, 1),
        author: asyncRelation(whereXQuery, 1),
        profile: deferred,
      }),
      [
        ['User', ['user', 'posts']],
        ['User', ['user', 'profile']],
      ],
    );
  });

  it('propagates a nested async plan through a plugin-owned select (A-6)', async () => {
    await sameAs(
      '{ user { posts(take: 2) { id author(x: 1) { name } } } }',
      withWraps({ posts: pluginRelation(takeQuery), author: asyncRelation(whereXQuery, 1) }),
      [['User', ['user', 'posts']]],
    );
  });

  it('awaits an async relation query', async () => {
    const async = withSelects(['posts'], (_select, name) => (_args, _ctx, nested) => ({
      select: { [name]: nested(async (args) => takeQuery(args as Args)) },
    }));

    // A relation query that returns a promise makes the nested selection a promise, which a
    // synchronous select cannot embed (A-6): the invocation returned while its nested selection
    // was still pending, which is what it is refused for (A-8)...
    const info = await resolveInfo(schema, '{ user { posts(take: 2) { id } } }');

    expect(() => queryFromInfo(async, { context: {}, info })).toThrow(
      'The selection function of User.posts returned while a nested selection it started was still pending',
    );

    // ...so the select awaits it.
    await sameAs(
      '{ user { posts(take: 2) { id author { name } } } }',
      withSelects(['posts'], (_select, name) => async (_args, _ctx, nested) => ({
        select: { [name]: await nested(async (args) => takeQuery(args as Args)) },
      })),
      [['User', ['user', 'posts']]],
    );
  });

  it('rejects an async select that embeds a nested selection without awaiting it', async () => {
    const async = withSelects(['posts'], (_select, name) => async (_args, _ctx, nested) => ({
      select: { [name]: nested(async () => ({ take: 1 })) },
    }));
    const info = await resolveInfo(schema, '{ user { posts { id } } }');

    await expect(queryFromInfo(async, { context: {}, info })).rejects.toThrow(
      'The selection function of User.posts returned while a nested selection it started was still pending',
    );
  });

  it('runs a select as soon as its async arguments resolve (S-6)', async () => {
    const info = await resolveInfo(schema, '{ user { posts(take: 2) { id } } }');
    const field = (schema.getType('User') as GraphQLObjectType).getFields().posts;
    const seen: string[] = [];
    const spied = withSelects(['posts'], (select) => (args, ...rest) => {
      seen.push(`select:${JSON.stringify(args)}`);

      return select(args, ...rest);
    });

    field.extensions = {
      ...field.extensions,
      pothosArgMappers: [
        async (args: { take: number }) => {
          seen.push('mapper');
          await new Promise((resolve) => setTimeout(resolve, 1));

          return { take: args.take * 10 };
        },
      ],
    };

    try {
      const context = {};
      const result = queryFromInfo(spied, { context, info });

      expect(seen).toEqual(['mapper']);
      expect(await result).toEqual({ select: { posts: { take: 20 } } });
      expect(seen).toEqual(['mapper', 'select:{"take":20}']);
      expect(mappingOf(getLoaderMapping(context, pathOf('user', 'posts'), 'User'))).toEqual({
        nested: {},
      });
    } finally {
      field.extensions = { ...field.extensions, pothosArgMappers: undefined };
    }
  });

  it('starts every callback of a plan in the same tick (A-3)', async () => {
    const started: string[] = [];
    const async = withSelects(['posts', 'profile'], (select, name) => async (...args) => {
      started.push(name);
      await new Promise((resolve) => setTimeout(resolve, 1));

      return select(...args);
    });
    const info = await resolveInfo(schema, '{ user { posts { id } profile { bio } } }');

    const result = queryFromInfo(async, { context: {}, info });

    expect(started).toEqual(['posts', 'profile']);
    expect(await result).toEqual({ select: { posts: true, profile: true } });
  });

  it('merges sync selections first, then async ones in document order (A-4, D-5)', async () => {
    // `first` takes 1 and is async; `second` takes 2 and is sync. They conflict on `take`.
    const syncWins = withSelects(['posts'], (select) => (args, ...rest) => {
      const map = select(args, ...rest);

      return (args as { take: number }).take === 1 ? Promise.resolve(map) : map;
    });
    const info = await resolveInfo(
      schema,
      '{ user { first: posts(take: 1) { id } second: posts(take: 2) { id } } }',
    );
    const context = {};

    expect(await queryFromInfo(syncWins, { context, info })).toEqual({
      select: { posts: { take: 2 } },
    });
    expect(mappingOf(getLoaderMapping(context, pathOf('user', 'second'), 'User'))).toEqual({
      nested: {},
    });
    expect(getLoaderMapping(context, pathOf('user', 'first'), 'User')).toBe(null);

    // Both async: `first` resolves last but was appended first, so it wins.
    const appendOrder = withSelects(['posts'], (select) => (args, ...rest) => {
      const map = select(args, ...rest);

      return (args as { take: number }).take === 1
        ? new Promise((resolve) => setTimeout(() => resolve(map), 5))
        : Promise.resolve(map);
    });
    const ordered = {};

    expect(await queryFromInfo(appendOrder, { context: ordered, info })).toEqual({
      select: { posts: { take: 1 } },
    });
    expect(mappingOf(getLoaderMapping(ordered, pathOf('user', 'first'), 'User'))).toEqual({
      nested: {},
    });
    expect(getLoaderMapping(ordered, pathOf('user', 'second'), 'User')).toBe(null);
  });

  it('unions the mappings of a key accepted from an async and a sync plan', async () => {
    const source = /* GraphQL */ `{
      user {
        ... on User { posts { author { name } } }
        ... on User { posts { comments { id } } }
      }
    }`;
    // The first `posts` plan is async (its `author` is), the second is sync.
    const mixed = withWraps({ posts: pluginRelation(), author: asyncRelation(undefined, 1) });

    await sameAs(source, mixed, [['User', ['user', 'posts']]]);

    const context = {};

    await queryFromInfo(mixed, { context, info: await resolveInfo(schema, source) });

    // The sync plan was merged first (D-5); the async one unioned into its mapping.
    expect(Object.keys(getLoaderMapping(context, pathOf('user', 'posts'), 'User')!.nested)).toEqual(
      ['Post@comments', 'Post@author'],
    );
  });

  it('rejects the plan when a callback rejects', async () => {
    const failing = withWraps({
      posts: pluginRelation(),
      author: () => () => Promise.reject(new Error('no author')),
    });
    const info = await resolveInfo(schema, '{ user { posts { author { name } } } }');

    await expect(queryFromInfo(failing, { context: {}, info })).rejects.toThrow('no author');
  });

  it('plans a connection through an async relation query', async () => {
    const async = withSelects(
      ['postsConnection'],
      (select) => (args, ctx, nested, getNode, position) => {
        const nestedAsync: typeof nested = (query, path, type) =>
          nested(
            async () =>
              typeof query === 'function'
                ? query(args, ctx, position)
                : query === true
                  ? undefined
                  : query,
            path,
            type,
          );

        return select(args, ctx, nestedAsync, getNode, position);
      },
    );

    // The connection select embeds the nested promise synchronously, as `getQuery` helpers do
    // when not awaited.
    const info = await resolveInfo(
      schema,
      '{ user { postsConnection(first: 2) { totalCount nodes { id } } } }',
    );

    expect(() => queryFromInfo(async, { context: {}, info })).toThrow(
      'The selection function of User.postsConnection returned while a nested selection it started was still pending',
    );
  });

  it('settles planFromInfo, then queryFromPlan emits synchronously', async () => {
    const source = '{ user { posts(take: 2) { id author(x: 1) { name } } } }';
    const info = await resolveInfo(schema, source);
    const syncContext = {};
    const expected = queryFromInfo(adapter, { context: syncContext, info, initial: { take: 1 } });
    const context = {};
    const pending = planFromInfo(
      withWraps({ posts: pluginRelation(takeQuery), author: asyncRelation(whereXQuery, 1) }),
      { context, info },
    );

    expect(isThenable(pending)).toBe(true);

    const plan = (await pending)!;
    // A resolver handed the settled plan emits without creating a promise.
    const { result, promises } = countPromises(() => queryFromPlan(plan, { take: 1 }));

    expect(promises).toBe(0);
    expect(result).toEqual(expected);
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toEqual(
      getLoaderMapping(syncContext, pathOf('user', 'posts'), 'User'),
    );
  });

  it('returns the loader plan after its async select, then enters the parent type (E-2)', async () => {
    const info = await resolveInfo(schema, '{ viewer { posts(take: 2) { id } } }', {
      at: ['Viewer', 'posts'],
    });
    const plan = await rowPlanFromInfo(withSelects(['posts'], deferred), {}, info);

    // The type-level `posts: { take: 5 }` conflicts with the field's `take: 2`, merged first.
    expect(adapter.accumulator.emit(plan.root)).toEqual({
      select: { posts: { take: 2 }, id: true },
    });
    expect(mappingsOf(plan.mappings)).toEqual({ 'Viewer@posts': { nested: {} } });

    const direct = (await planFromInfo(withSelects(['posts'], deferred), {
      context: {},
      info: await resolveInfo(schema, '{ user { posts { id } } }'),
      typeName: 'User',
    }))!;

    expect(adapter.accumulator.emit(play(direct).root)).toEqual({ select: { posts: true } });
  });
});

/**
 * Runs `run`, then gives anything it left pending time to settle, and expects no unhandled
 * rejection in the meantime.
 */
async function withoutUnhandledRejection(run: () => Promise<void>) {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => {
    unhandled.push(reason);
  };

  process.on('unhandledRejection', onUnhandled);

  try {
    await run();
    await sleep(30);

    expect(unhandled).toEqual([]);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

describe('a nested selection that was not awaited (A-8)', () => {
  const message =
    'The selection function of User.posts returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.';
  const rejecting: Wrap = () => () => Promise.reject(new Error('no author'));

  /** A sync select that starts the nested selection and returns without it. */
  const discarding: Wrap = (_select, name) => (_args, _ctx, nested) => {
    nested({});

    return { select: { [name]: true } };
  };

  /** An async select that does the same, returning after `delay`. */
  const discardingAsync =
    (delay: number): Wrap =>
    (_select, name) =>
    async (_args, _ctx, nested) => {
      nested({});
      await sleep(delay);

      return { select: { [name]: true } };
    };

  const source = '{ user { posts { author { name } } } }';

  it('refuses a sync select whose discarded nested plan rejects, without an unhandled rejection', async () => {
    await withoutUnhandledRejection(async () => {
      const context = {};
      const info = await resolveInfo(schema, source);

      expect(() =>
        queryFromInfo(withWraps({ posts: discarding, author: rejecting }), { context, info }),
      ).toThrow(message);
      expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);
    });
  });

  it('refuses an async select whose discarded nested plan rejected before it returned', async () => {
    await withoutUnhandledRejection(async () => {
      const context = {};
      const info = await resolveInfo(schema, source);

      await expect(
        queryFromInfo(withWraps({ posts: discardingAsync(5), author: rejecting }), {
          context,
          info,
        }),
      ).rejects.toThrow(message);
      expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);
    });
  });

  it('refuses an async select whose discarded nested plan resolves late, recording nothing', async () => {
    await withoutUnhandledRejection(async () => {
      const context = {};
      const info = await resolveInfo(schema, source);
      const late = withWraps({ posts: discardingAsync(1), author: asyncRelation(undefined, 20) });

      await expect(queryFromInfo(late, { context, info })).rejects.toThrow(message);
      expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);

      // The discarded plan completes after the invocation was refused: still nothing recorded.
      await sleep(25);

      expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);
    });
  });

  it('accepts a nested selection that was awaited, and records the same mapping as the sync plan', async () => {
    await sameAs(
      source,
      withWraps({ posts: asyncRelation(), author: asyncRelation(undefined, 1) }),
      [['User', ['user', 'posts']]],
    );
  });
});

describe('a plan that throws after a callback started (M-2)', () => {
  const rejecting: Wrap = () => () => Promise.reject(new Error('late'));
  const throwing: Wrap = () => () => {
    throw new Error('sync');
  };

  it('handles the pending merges of every entry point before rethrowing', async () => {
    await withoutUnhandledRejection(async () => {
      const failing = withWraps({ posts: rejecting, profile: throwing });
      const info = await resolveInfo(schema, '{ user { posts { id } profile { bio } } }');

      expect(() => queryFromInfo(failing, { context: {}, info })).toThrow('sync');
      expect(() => planFromInfo(failing, { context: {}, info, typeName: 'User' })).toThrow('sync');

      const paths = await resolveInfo(
        schema,
        '{ entries { ... on AppointmentEntry { appointment { posts { id } profile { bio } } } } }',
      );

      expect(() =>
        queryFromInfo(failing, {
          context: {},
          info: paths,
          typeName: 'User',
          path: ['appointment'],
        }),
      ).toThrow('sync');
    });
  });

  it('handles the pending merge of a loader plan whose second field node throws', async () => {
    await withoutUnhandledRejection(async () => {
      let calls = 0;
      const failing = withSelects(['posts'], () => () => {
        calls += 1;

        if (calls === 1) {
          return Promise.reject(new Error('late'));
        }

        throw new Error('sync');
      });
      // Two nodes select the field, so the loader plan applies two selects to the one row.
      const info = await resolveInfo(
        schema,
        '{ viewer { ... on Viewer { posts { id } } ... on Viewer { posts { title } } } }',
        { at: ['Viewer', 'posts'] },
      );

      expect(() => rowPlanFromInfo(failing, {}, info)).toThrow('sync');
      expect(calls).toBe(2);
    });
  });

  it('handles the pending merge of a nested plan that throws', async () => {
    await withoutUnhandledRejection(async () => {
      const failing = withWraps({ author: rejecting, comments: throwing });
      const info = await resolveInfo(
        schema,
        '{ user { posts { author { name } comments { id } } } }',
      );

      expect(() => queryFromInfo(failing, { context: {}, info })).toThrow('sync');
    });
  });
});

describe('the synchronous path (A-1)', () => {
  const source = /* GraphQL */ `{
    user {
      id
      posts(take: 2) { id author(x: 1) { name } ... on Post { comments { author { id } } } }
      profile { bio }
      postsConnection(first: 2) { totalCount nodes { id } edges { node { title } } }
    }
  }`;

  it('creates no promise', async () => {
    const context = {};
    const info = await resolveInfo(schema, source);
    const { result, promises } = countPromises(() => queryFromInfo(adapter, { context, info }));

    expect(promises).toBe(0);
    expect(isThenable(result)).toBe(false);
    expect(result).toEqual({
      extras: { postsCount: true },
      select: {
        posts: {
          take: 2,
          select: { author: { where: { x: 1 } }, comments: { select: { author: true } } },
        },
        profile: true,
      },
    });
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).not.toBe(null);
  });

  it('creates no promise for the loader entry points', async () => {
    const info = await resolveInfo(schema, '{ viewer { posts(take: 2) { id } } }', {
      at: ['Viewer', 'posts'],
    });

    expect(countPromises(() => rowPlanFromInfo(adapter, {}, info)).promises).toBe(0);
    expect(
      countPromises(() =>
        planFromInfo(adapter, {
          context: {},
          info,
          typeName: 'Post',
        }),
      ).promises,
    ).toBe(0);
  });

  it('replays an async plan over a conflicting selection without a promise', async () => {
    const source = '{ user { posts(take: 2) { id author(x: 1) { name } } } }';
    const info = await resolveInfo(schema, source);
    const select = { select: { posts: { take: 1 } } };
    const expectedContext = {};
    const expected = queryFromInfo(adapter, { context: expectedContext, info, initial: select });
    const context = {};
    const plan = (await planFromInfo(
      withWraps({ posts: pluginRelation(takeQuery), author: asyncRelation(whereXQuery, 1) }),
      { context, info },
    ))!;
    const { result, promises } = countPromises(() => queryFromPlan(plan, select));

    expect(promises).toBe(0);
    expect(result).toEqual(expected);
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);
  });

  it('creates no promise for a plan settled before its resolver runs', async () => {
    const context = {};
    const info = await resolveInfo(schema, source);
    const { result, promises } = countPromises(() =>
      queryFromPlan(planFromInfo(adapter, { context, info })!, { take: 1 }),
    );

    expect(promises).toBe(0);
    expect(result).toEqual(queryFromInfo(adapter, { context: {}, info, initial: { take: 1 } }));
  });

  it('counts the promises the spy is meant to see', () => {
    expect(countPromises(() => Promise.resolve(1)).promises).toBe(1);
    expect(countPromises(() => Promise.resolve(1).then(() => 2)).promises).toBe(2);
    expect(countPromises(() => Promise.all([])).promises).toBe(1);
    expect(countPromises(() => new Promise(() => {})).promises).toBe(1);
  });
});
