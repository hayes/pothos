import SchemaBuilder from '@pothos/core';
import { execute, subscribe } from 'graphql';
import { gql } from 'graphql-tag';
import Mocks from '../src';

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
});
