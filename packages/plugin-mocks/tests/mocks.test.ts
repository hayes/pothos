import SchemaBuilder from '@pothos/core';
import { execute, subscribe } from 'graphql';
import { gql } from 'graphql-tag';
import { vi } from 'vitest';
import Mocks, { PothosMocksPlugin } from '../src';

describe('mock resolution', () => {
  it('applies object mocks to fields inherited from an interface', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    const Node = builder.interfaceRef<{}>('Node').implement({
      resolveType: () => 'Obj',
      fields: (t) => ({
        hello: t.string({ resolve: () => 'original' }),
      }),
    });

    const Obj = builder.objectRef<{}>('Obj').implement({
      interfaces: [Node],
      fields: () => ({}),
    });

    builder.queryType({
      fields: (t) => ({
        obj: t.field({ type: Obj, resolve: () => ({}) }),
      }),
    });

    const schema = builder.toSchema({
      mocks: {
        Obj: {
          hello: () => 'mocked',
        },
      },
    });

    const result = await execute({
      schema,
      document: gql`
        query {
          obj {
            hello
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { obj: { hello: 'mocked' } } });
  });

  it('still applies interface mocks to inherited fields', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    const Node = builder.interfaceRef<{}>('Node').implement({
      resolveType: () => 'Obj',
      fields: (t) => ({
        hello: t.string({ resolve: () => 'original' }),
      }),
    });

    const Obj = builder.objectRef<{}>('Obj').implement({
      interfaces: [Node],
      fields: () => ({}),
    });

    builder.queryType({
      fields: (t) => ({
        obj: t.field({ type: Obj, resolve: () => ({}) }),
      }),
    });

    const schema = builder.toSchema({
      mocks: {
        Node: {
          hello: () => 'mocked',
        },
      },
    });

    const result = await execute({
      schema,
      document: gql`
        query {
          obj {
            hello
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { obj: { hello: 'mocked' } } });
  });

  it('does not mock unlisted fields that share a name with Object.prototype members', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    builder.queryType({
      fields: (t) => ({
        toString: t.string({ resolve: () => 'original' }),
        constructor: t.string({ resolve: () => 'original' }),
      }),
    });

    const schema = builder.toSchema({ mocks: { Query: {} } });

    const result = await execute({
      schema,
      document: gql`
        query {
          toString
          constructor
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { toString: 'original', constructor: 'original' } });
  });

  it('does not mock fields on types that share a name with Object.prototype members', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    const Constructor = builder.objectRef<{}>('constructor').implement({
      fields: (t) => ({
        call: t.string({ resolve: () => 'original' }),
      }),
    });

    builder.queryType({
      fields: (t) => ({
        obj: t.field({ type: Constructor, resolve: () => ({}) }),
      }),
    });

    const schema = builder.toSchema({ mocks: {} });

    const result = await execute({
      schema,
      document: gql`
        query {
          obj {
            call
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { obj: { call: 'original' } } });
  });

  it('does not use prototype members as subscribe mocks', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    builder.queryType({
      fields: (t) => ({
        hello: t.string({ resolve: () => 'original' }),
      }),
    });

    builder.subscriptionType({
      fields: (t) => ({
        toString: t.string({
          subscribe: async function* subscribeField() {
            yield await Promise.resolve('original');
          },
          resolve: (value) => value as string,
        }),
      }),
    });

    const schema = builder.toSchema({ mocks: { Subscription: {} } });

    const iterator = (await subscribe({
      schema,
      document: gql`
        subscription {
          toString
        }
      `,
      contextValue: {},
    })) as AsyncGenerator<unknown>;

    const first = await iterator.next();

    expect(first.value).toEqual({ data: { toString: 'original' } });
  });
});

describe('mock maps that are not plain objects', () => {
  const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

  builder.queryType({
    fields: (t) => ({
      hello: t.string({ resolve: () => 'original' }),
    }),
  });

  type MockMap = NonNullable<NonNullable<Parameters<typeof builder.toSchema>[0]>['mocks']>;

  function queryHello(mocks: MockMap) {
    return execute({
      schema: builder.toSchema({ mocks }),
      document: gql`
        query {
          hello
        }
      `,
      contextValue: {},
    });
  }

  it('uses mocks served by a Proxy', async () => {
    const mocks = new Proxy(
      {},
      {
        get: (_target, key) => (key === 'Query' ? { hello: () => 'mocked' } : undefined),
      },
    ) as MockMap;

    expect(await queryHello(mocks)).toEqual({ data: { hello: 'mocked' } });
  });

  it('uses mocks inherited from a user provided prototype', async () => {
    const mocks = Object.create({
      Query: { hello: () => 'mocked' },
    }) as MockMap;

    expect(await queryHello(mocks)).toEqual({ data: { hello: 'mocked' } });
  });

  it('uses mocks defined as methods on a class', async () => {
    class QueryMocks {
      hello() {
        return 'mocked';
      }
    }

    const mocks = { Query: new QueryMocks() } as unknown as MockMap;

    expect(await queryHello(mocks)).toEqual({ data: { hello: 'mocked' } });
  });

  it('uses mocks a Proxy supplies for a built-in member name', async () => {
    const collidingBuilder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    collidingBuilder.queryType({
      fields: (t) => ({
        toString: t.string({ resolve: () => 'original' }),
      }),
    });

    const fieldMocks = new Proxy(
      {},
      {
        get: () => () => 'mocked',
      },
    );

    const schema = collidingBuilder.toSchema({
      mocks: { Query: fieldMocks } as unknown as MockMap,
    });

    const result = await execute({
      schema,
      document: gql`
        query {
          toString
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { toString: 'mocked' } });
  });

  it('uses mocks a Proxy supplies for a type named like a built-in member', async () => {
    const collidingBuilder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    const Constructor = collidingBuilder.objectRef<{}>('constructor').implement({
      fields: (t) => ({
        call: t.string({ resolve: () => 'original' }),
      }),
    });

    collidingBuilder.queryType({
      fields: (t) => ({
        obj: t.field({ type: Constructor, resolve: () => ({}) }),
      }),
    });

    const typeMocks = new Proxy(
      {},
      {
        get: (_target, key) => (key === 'constructor' ? { call: () => 'mocked' } : undefined),
      },
    );

    const schema = collidingBuilder.toSchema({ mocks: typeMocks as unknown as MockMap });

    const result = await execute({
      schema,
      document: gql`
        query {
          obj {
            call
          }
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { obj: { call: 'mocked' } } });
  });

  it('uses mocks supplied for names guarded by Function.prototype', async () => {
    const collidingBuilder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    collidingBuilder.queryType({
      fields: (t) => ({
        caller: t.string({ resolve: () => 'original' }),
        arguments: t.string({ resolve: () => 'original' }),
      }),
    });

    const fieldMocks = Object.create({
      caller: () => 'mocked',
      arguments: () => 'mocked',
    }) as {};

    const schema = collidingBuilder.toSchema({
      mocks: { Query: fieldMocks } as unknown as MockMap,
    });

    const result = await execute({
      schema,
      document: gql`
        query {
          caller
          arguments
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { caller: 'mocked', arguments: 'mocked' } });
  });

  it('uses mocks a Proxy supplies for names guarded by Function.prototype', async () => {
    const collidingBuilder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    collidingBuilder.queryType({
      fields: (t) => ({
        caller: t.string({ resolve: () => 'original' }),
      }),
    });

    const typeMocks = new Proxy(
      {},
      {
        get: (_target, key) => (key === 'Query' ? { caller: () => 'mocked' } : undefined),
      },
    );

    const schema = collidingBuilder.toSchema({ mocks: typeMocks as unknown as MockMap });

    const result = await execute({
      schema,
      document: gql`
        query {
          caller
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { caller: 'mocked' } });
  });

  it('does not mock unlisted fields named after restricted function members', async () => {
    const collidingBuilder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    collidingBuilder.queryType({
      fields: (t) => ({
        caller: t.string({ resolve: () => 'original' }),
        arguments: t.string({ resolve: () => 'original' }),
      }),
    });

    const schema = collidingBuilder.toSchema({ mocks: { Query: {} } as unknown as MockMap });

    const result = await execute({
      schema,
      document: gql`
        query {
          caller
          arguments
        }
      `,
      contextValue: {},
    });

    expect(result).toEqual({ data: { caller: 'original', arguments: 'original' } });
  });
});

describe('interface field mock lookups', () => {
  it('resolves the mock once per concrete type instead of once per field resolution', async () => {
    const builder = new SchemaBuilder<{ Context: {} }>({ plugins: [Mocks] });

    const Named = builder.interfaceRef<{ a: string; b: string }>('Named').implement({
      resolveType: () => 'Obj',
      fields: (t) => ({
        a: t.exposeString('a'),
        b: t.exposeString('b'),
      }),
    });

    const Obj = builder.objectRef<{ a: string; b: string }>('Obj').implement({
      interfaces: [Named],
      fields: () => ({}),
    });

    builder.queryType({
      fields: (t) => ({
        objs: t.field({
          type: [Obj],
          resolve: () => Array.from({ length: 5 }, () => ({ a: 'a', b: 'b' })),
        }),
      }),
    });

    const schema = builder.toSchema({ mocks: { Query: {} } });

    const resolveMock = vi.spyOn(PothosMocksPlugin.prototype, 'resolveMock');

    try {
      const result = await execute({
        schema,
        document: gql`
          query {
            objs {
              a
              b
            }
          }
        `,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(resolveMock).toHaveBeenCalledTimes(2);
    } finally {
      resolveMock.mockRestore();
    }
  });
});
