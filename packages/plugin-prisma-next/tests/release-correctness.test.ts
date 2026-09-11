import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, experimentalExecuteIncrementally, GraphQLScalarType, parse } from 'graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import {
  type CapturedExecution,
  createTestRuntime,
  type SampleContract,
  type TestRuntimeContext,
  withCapture,
} from './fixtures/runtime';

let ctx: TestRuntimeContext;
beforeAll(async () => {
  ctx = await createTestRuntime();
});
afterAll(async () => {
  await ctx?.cleanup();
});

function nodeSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: ctx.contract },
  });
  builder.prismaNode('User', {
    id: { field: 'id' },
    collection: ctx.ormClient.User,
    fields: (t) => ({
      firstName: t.exposeString('firstName'),
      posts: t.relation('posts'),
      postConnection: t.relatedConnection('posts', { cursor: 'id', totalCount: true }),
    }),
  });
  builder.prismaNode('Post', {
    id: { field: 'id' },
    collection: ctx.ormClient.Post,
    fields: (t) => ({ title: t.exposeString('title'), author: t.relation('author') }),
  });
  builder.queryType({
    fields: (t) => ({
      user: t.prismaField({
        type: 'User',
        resolve: () => ctx.ormClient.User.where({ id: 'u-alice' }),
      }),
      users: t.prismaConnection({ type: 'User', cursor: 'id', resolve: () => ctx.ormClient.User }),
    }),
  });
  return builder.toSchema();
}

describe('Relay node types across planned entry points', () => {
  it('resolves node types through root, related and connection fields without brands', async () => {
    const result = await execute({
      schema: nodeSchema(),
      document: parse(`{
        user {
          firstName
          posts { title author { firstName } }
          postConnection(first: 1) { edges { node { title } } }
        }
        users(first: 1) { edges { node { firstName } } }
      }`),
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: {
        firstName: 'Alice',
        posts: [
          { title: 'Hello, Pothos', author: { firstName: 'Alice' } },
          { title: 'Draft #1', author: { firstName: 'Alice' } },
        ],
        postConnection: { edges: [{ node: { title: 'Draft #1' } }] },
      },
      users: { edges: [{ node: { firstName: 'Alice' } }] },
    });
  });

  it('selects the columns required by the Relay ID on direct object fields', async () => {
    const result = await execute({
      schema: nodeSchema(),
      document: parse('{ user { id firstName } }'),
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: {
        id: Buffer.from('User:u-alice').toString('base64'),
        firstName: 'Alice',
      },
    });
  });

  it('does not load connection rows when only the related count is selected', async () => {
    const captures: CapturedExecution[] = [];
    const result = await withCapture(captures, async () =>
      execute({
        schema: nodeSchema(),
        document: parse('{ user { postConnection { totalCount } } }'),
        contextValue: {},
      }),
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: { postConnection: { totalCount: 2 } } });
    const sql = captures.map((capture) => capture.sql).join(' ');
    expect(sql).toMatch(/count\(/i);
    expect(sql).not.toMatch(/postConnection:rows|"title"|"score"/i);
  });

  it('still resolves the abstract Node interface with the loader brand', async () => {
    const result = await execute({
      schema: nodeSchema(),
      document: parse('query($id: ID!) { node(id: $id) { __typename ... on User { firstName } } }'),
      variableValues: { id: Buffer.from('User:u-alice').toString('base64') },
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { __typename: 'User', firstName: 'Alice' } });
  });
});

describe('complete query planning', () => {
  it.each([
    ['row', { id: 'u-alice' }],
    ['rows', [{ id: 'u-alice' }]],
  ])('rejects an already materialized %s at the prismaField boundary', async (_name, value) => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: 'User', resolve: (() => value) as never }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ user { id } }'),
      contextValue: {},
    });
    expect(result.errors?.[0].message).toMatch(/must return an ORM Collection or null/);
  });

  it('allows an explicitly absent nullable result', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: ctx.contract },
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({ type: 'User', nullable: true, resolve: () => null }),
      }),
    });
    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ user { id } }'),
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ user: null });
  });

  it('loads deferred scalar and nested relation selections before the initial payload', async () => {
    const captures: CapturedExecution[] = [];
    await withCapture(captures, async () => {
      const result = await experimentalExecuteIncrementally({
        schema: nodeSchema(),
        document: parse('{ user { ... @defer { firstName posts { title } } } }'),
        contextValue: {},
      });
      expect(result).toHaveProperty('initialResult');
      if (!('initialResult' in result)) {
        throw new Error('Expected incremental execution');
      }
      expect(result.initialResult.errors).toBeUndefined();
      expect(result.initialResult.data).toEqual({ user: {} });
      const initialQueries = captures.length;
      expect(initialQueries).toBeGreaterThan(0);
      const patches = [];
      for await (const patch of result.subsequentResults) {
        patches.push(patch);
      }
      expect(patches).toEqual([
        expect.objectContaining({
          incremental: [
            expect.objectContaining({
              data: {
                firstName: 'Alice',
                posts: [{ title: 'Hello, Pothos' }, { title: 'Draft #1' }],
              },
            }),
          ],
        }),
      ]);
      expect(captures).toHaveLength(initialQueries);
      expect(captures.map(({ sql }) => sql).join(' ')).toMatch(/firstName/);
      expect(captures.map(({ sql }) => sql).join(' ')).toMatch(/title/);
    });
  });
});

describe('relation aggregate result scalars', () => {
  it('preserves fractional sums and extrema and applies a custom result scalar', async () => {
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
      Scalars: {
        Amount: { Input: number; Output: number };
        BigInt: { Input: bigint; Output: bigint };
      };
    }>({ plugins: [prismaNextPlugin], prismaNext: { contract: ctx.contract } });
    builder.addScalarType(
      'Amount',
      new GraphQLScalarType({
        name: 'Amount',
        serialize: (value) => Number(value).toFixed(2),
      }),
    );
    builder.addScalarType(
      'BigInt',
      new GraphQLScalarType({ name: 'BigInt', serialize: (value) => String(value) }),
    );
    builder.prismaObject('User', {
      fields: (t) => ({
        countBigInt: t.relationAggregate('posts', { op: 'countBigInt', type: 'BigInt' }),
        sumBigInt: t.relationAggregate('posts', {
          op: 'sumBigInt',
          field: 'published',
          type: 'BigInt',
        }),
        minimumTitle: t.relationAggregate('posts', { op: 'min', field: 'title', type: 'String' }),
        total: t.relationAggregate('posts', { op: 'sum', field: 'score' }),
        minimum: t.relationAggregate('posts', { op: 'min', field: 'score' }),
        maximum: t.relationAggregate('posts', { op: 'max', field: 'score' }),
        average: t.relationAggregate('posts', { op: 'avg', field: 'score' }),
        amount: t.relationAggregate('posts', { op: 'sum', field: 'score', type: 'Amount' }),
        missing: t.relationAggregate('posts', {
          op: 'sum',
          field: 'score',
          where: { id: 'absent' },
        }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: 'User',
          resolve: () => ctx.ormClient.User.where({ id: 'u-alice' }),
        }),
      }),
    });
    const schema = builder.toSchema();
    const result = await execute({
      schema,
      document: parse(
        '{ user { countBigInt sumBigInt minimumTitle total minimum maximum average amount missing } }',
      ),
      contextValue: {},
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: {
        countBigInt: '2',
        sumBigInt: '1',
        minimumTitle: 'Draft #1',
        total: 3.75,
        minimum: 1.5,
        maximum: 2.25,
        average: 1.875,
        amount: '3.75',
        missing: null,
      },
    });
  });
});
