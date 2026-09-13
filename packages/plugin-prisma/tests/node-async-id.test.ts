import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import { afterAll, describe, expect, it, vi } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { ModelLoader } from '../src/model-loader';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

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

const ROWS = 5;

const FAILING_ROW = 3;

let microtasks = 0;

const issuedAt: number[] = [];

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

let resolveId: (user: { id: number }) => unknown = (user) => String(user.id);

const StubUser = stubBuilder.prismaNode('User', {
  variant: 'StubUser',
  id: { resolve: (user) => resolveId(user) as never },
  findUnique: (id) => ({ id: Number(id) }),
  fields: (t) => ({
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
    expect(issuedAt.every((at) => at > 0)).toBe(true);
  });

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
    expect(result.data).toEqual({
      rows: Array.from({ length: ROWS }, (_, index) => ({
        name: index + 1 === FAILING_ROW ? null : `user-${index + 1}`,
      })),
    });
  });

  it('rejects every model in the batch when findUnique throws synchronously', async () => {
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
    expect(result.errors?.map((error) => error.path?.[1])).toContain(FAILING_ROW);
    expect(result.errors?.map((error) => error.path?.[1])).toContain(ROWS - 1);
  });
});
