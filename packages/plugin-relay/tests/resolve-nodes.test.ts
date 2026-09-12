import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import RelayPlugin, { encodeGlobalID } from '../src';

describe('resolveNodes', () => {
  it.each([
    'constructor',
    'toString',
    'hasOwnProperty',
  ])('loads nodes for a type named %s', async (typename) => {
    const builder = new SchemaBuilder<{}>({ plugins: [RelayPlugin] });

    const ref = builder.objectRef<{ id: string }>(typename);

    builder.node(ref, {
      id: { resolve: (value) => value.id },
      loadOne: (id) => ({ id: String(id) }),
      fields: () => ({}),
    });

    builder.queryType({});

    const result = await graphql({
      schema: builder.toSchema(),
      source: 'query($id: ID!) { node(id: $id) { id } }',
      variableValues: { id: encodeGlobalID(typename, '1') },
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ node: { id: encodeGlobalID(typename, '1') } });
  });
});
