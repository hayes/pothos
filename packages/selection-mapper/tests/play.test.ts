/**
 * The property the two entry points claim: for the same document and the same caller selection,
 * `queryFromPlan(plan, select)` is what `queryFromInfo` produces with `select` as its `initial` —
 * the same query and the same loader mappings. `planFromInfo` collects merges without deciding
 * any of them, so a play behind `select` reaches every decision a fresh walk would.
 */
import { completeValue } from '@pothos/core';
import { describe, expect, it, vi } from 'vitest';
import type { Adapter, EntryOptions, SelectFn } from '../src';
import { planFromInfo, queryFromInfo, queryFromPlan } from '../src';
import type { Mappings } from '../src/loader-map';
import * as loaderMap from '../src/loader-map';
import type { FakeMap, FakeModel } from './fake-adapter';
import { mappingsOf, resolveInfo } from './fake-adapter';
import { createTestAdapter, createTestSchema } from './schema';

const schema = createTestSchema();
const sync = createTestAdapter();

type Select = SelectFn<FakeMap>;
type Args = Record<string, unknown>;
type Wrap = (select: Select, field: string) => Select;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `run`, awaits what it returns, and captures every `mappings` object handed to
 * `setLoaderMappings` while it settles — what a walk recorded, before the response paths a
 * resolver looks it up under are applied.
 */
async function captureMappings<T>(run: () => T) {
  const captured: unknown[] = [];
  const spy = vi
    .spyOn(loaderMap, 'setLoaderMappings')
    .mockImplementation((_ctx, _info, mappings: Mappings) => {
      captured.push(mappingsOf(mappings));
    });

  try {
    return { result: (await run()) as Awaited<T>, mappings: captured };
  } finally {
    spy.mockRestore();
  }
}

interface Side {
  result?: FakeMap;
  mappings: unknown[];
  threw?: string;
}

/** What a side produced, or the message it failed with: a throw is part of what must match. */
async function attempt(run: () => unknown): Promise<Side> {
  try {
    const captured = await captureMappings(run);

    return { result: captured.result as FakeMap, mappings: captured.mappings };
  } catch (error) {
    return { mappings: [], threw: (error as Error).message };
  }
}

/** The reference beside the mechanism: one fresh walk, one plan played behind `select`. */
async function diff(
  adapter: Adapter<FakeModel, FakeMap>,
  options: Omit<EntryOptions<FakeMap>, 'context'>,
  select: FakeMap | undefined,
) {
  const fresh = await attempt(() =>
    queryFromInfo(adapter, { ...options, context: {}, initial: select }),
  );
  const played = await attempt(async () => {
    const plan = await planFromInfo(adapter, { ...options, context: {} });

    return plan ? queryFromPlan(plan as never, select) : ((select ?? {}) as FakeMap);
  });

  return { fresh, played };
}

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

/** A relation select that awaits its own nested selection: the plan beneath it is async. */
const asyncRelation =
  (query?: (args: Args) => FakeMap, delay = 0): Wrap =>
  (_select, name) =>
  async (args, _ctx, nested) => {
    if (delay) {
      await sleep(delay);
    }

    return { select: { [name]: await nested(query?.(args as Args) ?? {}) } };
  };

/** A synchronous select that handles a possibly-async nested selection, as the plugins do. */
const pluginRelation =
  (query?: (args: Args) => FakeMap): Wrap =>
  (_select, name) =>
  (args, _ctx, nested) =>
    completeValue(nested(query?.(args as Args) ?? {}), (map) => ({ select: { [name]: map } }));

const deferredSelect: Wrap = (select) => async (args, ctx, nested, getNode, position) => {
  await sleep(1);

  return select(args, ctx, nested, getNode, position);
};

function withWraps(wraps: Record<string, Wrap>) {
  return withSelects(Object.keys(wraps), (select, name) => wraps[name](select, name));
}

const asyncAdapter = withWraps({
  posts: asyncRelation(takeQuery, 1),
  author: asyncRelation(whereXQuery, 1),
  profile: deferredSelect,
});

const nestedAsyncAdapter = withWraps({
  posts: pluginRelation(takeQuery),
  author: asyncRelation(whereXQuery, 1),
});

interface Case {
  name: string;
  source: string;
  select?: FakeMap;
  at?: [string, string];
  typeName?: string;
  paths?: string[][];
  adapter?: Adapter<FakeModel, FakeMap>;
}

const cases: Case[] = [
  {
    name: 'plain field, non-conflicting selection',
    source: '{ user { id posts(take: 2) { id author(x: 1) { name } } } }',
    select: { select: { profile: true }, take: 1 },
  },
  {
    name: 'plain field, conflicting relation arguments',
    source: '{ user { id posts(take: 2) { id } } }',
    select: { select: { posts: { take: 1 } } },
  },
  {
    name: 'no selection at all',
    source: '{ user { id posts(take: 2) { id } } }',
  },
  {
    name: 'type-level selection on a select-mode type',
    source: '{ viewer { email posts(take: 2) { id } } }',
    select: { select: { profile: true } },
  },
  {
    name: 'type-level selection, caller conflicts with the type-level relation',
    source: '{ viewer { email posts(take: 5) { id } } }',
    select: { select: { posts: { take: 9 } } },
  },
  {
    name: 'variant entered through a fragment',
    source: '{ person { id ... on Viewer { email posts(take: 5) { id } } } }',
    select: { select: { profile: true } },
  },
  {
    name: 'variant entered through a fragment, caller conflicts with the variant selection',
    source: '{ person { id ... on Viewer { email } } }',
    select: { select: { posts: { take: 9 } } },
  },
  {
    name: 'two conflicting variants',
    source: '{ person { id ... on Viewer { email } ... on Admin { posts(take: 1) { id } } } }',
    select: { select: { profile: true } },
  },
  {
    name: 'same field under two fragments',
    source: `
      { user { ...A ...B } }
      fragment A on User { posts(take: 2) { id } }
      fragment B on User { posts(take: 2) { title } }
    `,
    select: { select: { profile: true } },
  },
  {
    name: 'same field under two fragments with different arguments (the second loses)',
    source: `
      { user { ...A ...B } }
      fragment A on User { a: posts(take: 2) { id } }
      fragment B on User { b: posts(take: 9) { title } }
    `,
    select: { select: { posts: { take: 9 } } },
  },
  {
    name: 'the loser of an intra-document conflict, which the caller selection makes fit',
    source: `
      { user { ...A ...B } }
      fragment A on User { a: posts(take: 2) { id } }
      fragment B on User { b: posts(take: 9) { author(x: 5) { name } } }
    `,
    select: { select: { posts: { take: 9 } } },
  },
  {
    name: 'two occurrences of a field whose selections land on the same node',
    source: `
      { user { posts(take: 9) { ...A ...B } } }
      fragment A on Post { a: author(x: 1) { id } }
      fragment B on Post { b: author(x: 2) { name } }
    `,
    select: { select: { posts: { take: 9, select: { author: { where: { x: 2 } } } } } },
  },
  {
    name: 'connection with paths',
    source:
      '{ user { postsConnection(first: 2) { totalCount nodes { id } edges { node { title } } } } }',
    at: ['User', 'postsConnection'],
    typeName: 'Post',
    paths: [['nodes'], ['edges', 'node']],
    select: { select: { comments: true }, take: 3 },
  },
  {
    name: 'connection with paths, caller conflicts with a planned relation',
    source: '{ user { postsConnection(first: 2) { nodes { author(x: 1) { name } } } } }',
    at: ['User', 'postsConnection'],
    typeName: 'Post',
    paths: [['nodes'], ['edges', 'node']],
    select: { select: { author: { where: { x: 2 } } } },
  },
  {
    name: 'connection with paths, nothing selected under them',
    source: '{ user { postsConnection(first: 2) { totalCount } } }',
    at: ['User', 'postsConnection'],
    typeName: 'Post',
    paths: [['nodes'], ['edges', 'node']],
    select: { select: { comments: true } },
  },
  {
    name: 'async selects, non-conflicting selection',
    source: '{ user { id posts(take: 2) { id author(x: 1) { name } } profile { bio } } }',
    select: { take: 1 },
    adapter: asyncAdapter,
  },
  {
    name: 'async selects, conflicting selection',
    source: '{ user { id posts(take: 2) { id author(x: 1) { name } } } }',
    select: { select: { posts: { take: 1 } } },
    adapter: asyncAdapter,
  },
  {
    name: 'nested selection whose own plan is async',
    source: '{ user { posts(take: 2) { id author(x: 1) { name } } } }',
    select: { select: { posts: { take: 1 } } },
    adapter: nestedAsyncAdapter,
  },
  {
    name: 'nested async plan, non-conflicting selection',
    source: '{ user { posts(take: 2) { id author(x: 1) { name } } } }',
    select: { take: 7 },
    adapter: nestedAsyncAdapter,
  },
  {
    name: 'indirect include on the return type (union result)',
    source: '{ result { ... on UserSuccess { data { id posts(take: 2) { id } } } } }',
    select: { select: { profile: true } },
  },
  {
    name: 'interface list with same-model variants',
    source: `
      {
        entries {
          kind
          ... on AppointmentEntry { appointment { id posts(take: 2) { id } } }
        }
      }
    `,
    select: { select: { profile: true } },
  },
];

describe('queryFromPlan(plan, select) is queryFromInfo with select as initial', () => {
  for (const testCase of cases) {
    it(testCase.name, async () => {
      const { source, select, at, typeName, paths, adapter = sync } = testCase;
      const info = await resolveInfo(schema, source, { at });
      const options = {
        info,
        ...(typeName ? { typeName } : {}),
        ...(paths ? { paths } : {}),
      };
      const { fresh, played } = await diff(adapter, options as never, select);

      expect({ threw: played.threw, query: played.result }).toEqual({
        threw: fresh.threw,
        query: fresh.result,
      });
      expect(played.mappings).toEqual(fresh.mappings);
    });
  }
});

describe('a field that lost an intra-document conflict', () => {
  const source = `
    { user { ...A ...B } }
    fragment A on User { a: posts(take: 2) { id } }
    fragment B on User { b: posts(take: 9) { author(x: 5) { name } } }
  `;

  it('is taken by a play whose selection makes it fit, and maps what it plans', async () => {
    const info = await resolveInfo(schema, source);
    const { fresh, played } = await diff(sync, { info } as never, {
      select: { posts: { take: 9 } },
    });

    // Both sides plan `b`, whose `take: 9` matches the caller's, and neither plans `a`.
    expect(played.result).toEqual({
      select: { posts: { take: 9, select: { author: { where: { x: 5 } } } } },
    });
    expect(played.result).toEqual(fresh.result);
    expect(played.mappings).toEqual([{ 'User@b': { nested: { 'Post@author': { nested: {} } } } }]);
    expect(played.mappings).toEqual(fresh.mappings);
  });

  it('still loses when nothing makes it fit', async () => {
    const info = await resolveInfo(schema, source);
    const { fresh, played } = await diff(sync, { info } as never, undefined);

    expect(played.result).toEqual({ select: { posts: { take: 2 } } });
    expect(played.result).toEqual(fresh.result);
    expect(played.mappings).toEqual([{ 'User@a': { nested: {} } }]);
    expect(played.mappings).toEqual(fresh.mappings);
  });
});
