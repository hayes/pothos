import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { afterAll, describe, expect, it, vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { ModelLoader } from '../src/model-loader';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// `prismaNode`'s `id.resolve` is typed `MaybePromise`, and a node with a custom `findUnique`
// composes the two: the ID the resolver settles to is what the fallback lookup's `where` is built
// from. Only the loader path is covered here — `node(id:)` and the exposed ID field both decode
// the ID before they reach `findUnique`, and never saw the promise.

/** The ID the user's `findUnique` callback was handed, recorded as it actually received it. */
const seen: unknown[] = [];

const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: { user: { id: number } };
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  relay: {},
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const AsyncIdUser = builder.prismaNode('User', {
  variant: 'AsyncIdUser',
  id: {
    resolve: async (user) => {
      await Promise.resolve();

      return String(user.id);
    },
  },
  findUnique: (id) => {
    seen.push(id);

    return { id: Number(id) };
  },
  fields: (t) => ({
    // Nothing the raw root field below loads, so the row falls back through the model loader.
    name: t.string({
      select: { name: true },
      resolve: (user) => user.name ?? '',
    }),
  }),
});

const SyncIdUser = builder.prismaNode('User', {
  variant: 'SyncIdUser',
  id: { resolve: (user) => String(user.id) },
  findUnique: (id) => {
    seen.push(id);

    return { id: Number(id) };
  },
  fields: (t) => ({
    name: t.string({
      select: { name: true },
      resolve: (user) => user.name ?? '',
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // A row carrying none of the node's own selection: `name` has to reload it.
    rawAsync: t.field({
      type: AsyncIdUser,
      resolve: () => ({ id: 1 }) as never,
    }),
    rawSync: t.field({
      type: SyncIdUser,
      resolve: () => ({ id: 1 }) as never,
    }),
  }),
});

const schema = builder.toSchema();

/** The `where` of every loader lookup the client issued; the parent `findMany`s are excluded. */
function loaderWheres() {
  return (queries as { action: string; args: { where?: unknown } }[])
    .filter((query) => query.action !== 'findMany')
    .map((query) => query.args.where);
}

describe('async custom node IDs on the fallback lookup', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('awaits an async id resolver before calling findUnique', async () => {
    seen.length = 0;
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql`{ rawAsync { name } }`,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    // The callback's own type promises a string. Unawaited it received the promise the resolver
    // returned, and `Number(promise)` made the where below `{ id: NaN }`.
    expect(seen).toEqual(['1']);
    expect(loaderWheres()).toEqual([{ id: 1 }]);
    expect(result.data).toMatchObject({ rawAsync: { name: expect.any(String) } });
  });

  it('builds the same where from a synchronous id resolver', async () => {
    seen.length = 0;
    queries.length = 0;

    const result = await execute({
      schema,
      document: gql`{ rawSync { name } }`,
      contextValue: { user: { id: 1 } },
    });

    expect(result.errors).toBeUndefined();
    expect(seen).toEqual(['1']);
    expect(loaderWheres()).toEqual([{ id: 1 }]);
  });
});

// The loader's flush loop is what awaits the where, and the microtask a delegate call is issued
// in is not legible through a real client. The rest of these drive it against a stub delegate.

const ROWS = 5;

/** The row whose ID resolver fails in the containment cases below. */
const FAILING_ROW = 3;

/** Microtask boundaries crossed since the batch that is loading was opened. */
let microtasks = 0;

/** The value of `microtasks` at each delegate call, in the order the flush loop issued them. */
const issuedAt: number[] = [];

/**
 * How long the stub delegate takes to answer. `never` is only for the synchronous-throw case,
 * where a query the loop never issued is the thing being observed; every other case settles, and
 * is asserted to reach the same outcome whichever of the two settling speeds it runs at.
 */
let delegateSettles: 'immediately' | 'a macrotask later' | 'never' = 'immediately';

const stubClient = {
  user: {
    findUniqueOrThrow: (args: { where: { id: number } }) => {
      issuedAt.push(microtasks);

      const row = { id: args.where.id, name: `user-${args.where.id}` };

      switch (delegateSettles) {
        case 'never':
          return new Promise(() => {});
        case 'a macrotask later':
          return new Promise((resolve) => setTimeout(() => resolve(row), 1));
        default:
          return Promise.resolve(row);
      }
    },
  },
};

const stubBuilder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
  Context: {};
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  relay: {},
  prisma: {
    client: stubClient as never,
    dmmf: getDatamodel(),
  },
});

/** The ID resolvers each node below is built with, swapped per test. */
let resolveId: (user: { id: number }) => unknown = (user) => String(user.id);

const StubUser = stubBuilder.prismaNode('User', {
  variant: 'StubUser',
  id: { resolve: (user) => resolveId(user) as never },
  findUnique: (id) => ({ id: Number(id) }),
  fields: (t) => ({
    // Nullable so a row that fails shows as its own null beside the rows that loaded, rather
    // than bubbling up and taking the list with it.
    name: t.string({
      nullable: true,
      select: { name: true },
      resolve: (user) => user.name,
    }),
  }),
});

stubBuilder.queryType({
  fields: (t) => ({
    rows: t.field({
      type: [StubUser],
      resolve: () => Array.from({ length: ROWS }, (_, index) => ({ id: index + 1 })) as never,
    }),
  }),
});

const stubSchema = stubBuilder.toSchema();

/**
 * Runs `{ rows { name } }` while counting microtask boundaries from the moment the loader opens
 * its batch: `initLoad` registers the flush on an already-settled tick, so a synchronous
 * `findUnique` issues its delegate call before the first boundary counted here.
 */
async function countMicrotasks() {
  issuedAt.length = 0;
  microtasks = 0;

  const original = ModelLoader.prototype.initLoad;
  const opened = vi.spyOn(ModelLoader.prototype, 'initLoad');

  opened.mockImplementation(function tracked(this: ModelLoader, played, model) {
    const promise = original.call(this, played, model);

    const bump = () => {
      microtasks += 1;

      if (microtasks < 50) {
        Promise.resolve().then(bump);
      }
    };

    Promise.resolve().then(bump);

    return promise;
  });

  const result = await execute({
    schema: stubSchema,
    document: gql`{ rows { name } }`,
    contextValue: {},
  });

  opened.mockRestore();

  return result;
}

describe('the flush loop under an async where', () => {
  it('issues a synchronous findUnique in the microtask the batch flushes in', async () => {
    resolveId = (user) => String(user.id);

    const result = await countMicrotasks();

    expect(result.errors).toBeUndefined();
    // Zero boundaries crossed: the delegate call is made inside the flush callback itself, which
    // a blanket `await` over the loop would push past at least one of the ticks counted here.
    expect(issuedAt).toEqual(Array.from({ length: ROWS }, () => 0));
  });

  it('issues an async findUnique only once its where has settled', async () => {
    resolveId = async (user) => {
      await Promise.resolve();

      return String(user.id);
    };

    const result = await countMicrotasks();

    expect(result.errors).toBeUndefined();
    expect(issuedAt).toHaveLength(ROWS);
    // Every row waits for its own where, and none of them jumps the flush it belongs to.
    expect(issuedAt.every((at) => at > 0)).toBe(true);
  });

  // A where that rejects does so after the flush loop has run to its end, so every model already
  // holds a handler and none of them can be stranded. Rejecting the batch there would fail rows
  // whose own where was fine, and which of them it actually reached would depend on whether their
  // queries beat the rejection — so both settling speeds are asserted to the same outcome.
  it.each([
    'immediately',
    'a macrotask later',
  ] as const)('fails only the row whose where rejected, with a delegate that settles %s', async (settles) => {
    delegateSettles = settles;
    resolveId = (user) =>
      user.id === FAILING_ROW ? Promise.reject(new Error('id resolver failed')) : String(user.id);

    const result = await execute({
      schema: stubSchema,
      document: gql`{ rows { name } }`,
      contextValue: {},
    });

    delegateSettles = 'immediately';
    resolveId = (user) => String(user.id);

    expect(result.errors?.map((error) => error.message)).toEqual(['id resolver failed']);
    expect(result.errors?.[0].path).toEqual(['rows', FAILING_ROW - 1, 'name']);
    // The rows either side of it loaded; only the one that failed is null.
    expect(result.data).toEqual({
      rows: Array.from({ length: ROWS }, (_, index) => ({
        name: index + 1 === FAILING_ROW ? null : `user-${index + 1}`,
      })),
    });
  });

  it('rejects every model in the batch when findUnique throws synchronously', async () => {
    // A synchronous throw aborts the loop, so the rows after it were never issued a query at all.
    // The stub leaves the ones before it pending, so the request can only complete if the whole
    // batch rejected: without that, the rows the loop never reached hang and take the request
    // with them. This is the path `rejectBatch` exists for, and the one the async branch above
    // deliberately does not share.
    delegateSettles = 'never';
    resolveId = (user) => {
      if (user.id === FAILING_ROW) {
        throw new Error('findUnique threw');
      }

      return String(user.id);
    };

    const result = await execute({
      schema: stubSchema,
      document: gql`{ rows { name } }`,
      contextValue: {},
    });

    delegateSettles = 'immediately';
    resolveId = (user) => String(user.id);

    expect(result.errors).toHaveLength(ROWS);
    expect(result.errors?.map((error) => error.message)).toEqual(
      Array.from({ length: ROWS }, () => 'findUnique threw'),
    );
    // The rows the loop never reached, named explicitly: these are the ones that would hang.
    expect(result.errors?.map((error) => error.path?.[1])).toContain(FAILING_ROW);
    expect(result.errors?.map((error) => error.path?.[1])).toContain(ROWS - 1);
  });
});
