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

// The loader's flush loop is what awaits the where, and neither the microtask a delegate call is
// issued in nor the fate of a batch whose where rejects is legible through a real client. Both
// are driven against a stub delegate below.

const ROWS = 4;

/** Microtask boundaries crossed since the batch that is loading was opened. */
let microtasks = 0;

/** The value of `microtasks` at each delegate call, in the order the flush loop issued them. */
const issuedAt: number[] = [];

/** Batches whose queries the stub leaves pending, to prove the batch itself rejected them. */
let hangingQueries = 0;

const stubClient = {
  user: {
    findUniqueOrThrow: (args: { where: { id: number } }) => {
      issuedAt.push(microtasks);

      return hangingQueries > 0
        ? new Promise(() => {})
        : Promise.resolve({ id: args.where.id, name: `user-${args.where.id}` });
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
    name: t.string({
      select: { name: true },
      resolve: (user) => user.name ?? '',
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

  it('rejects every model in the batch when one row’s where rejects', async () => {
    // The rest of the batch is left pending by the stub, so the request can only complete if the
    // rejection reached models the loop had already issued queries for — the invariant the
    // synchronous `try/catch` gives a throwing `findUnique`.
    hangingQueries = 1;
    resolveId = (user) =>
      user.id === 1 ? Promise.reject(new Error('id resolver failed')) : String(user.id);

    const result = await execute({
      schema: stubSchema,
      document: gql`{ rows { name } }`,
      contextValue: {},
    });

    hangingQueries = 0;
    resolveId = (user) => String(user.id);

    expect(result.errors).toHaveLength(ROWS);
    expect(result.errors?.map((error) => error.message)).toEqual(
      Array.from({ length: ROWS }, () => 'id resolver failed'),
    );
  });
});
