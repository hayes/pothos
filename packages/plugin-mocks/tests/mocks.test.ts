import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
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
});
