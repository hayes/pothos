import SchemaBuilder from '@pothos/core';
import { type GraphQLInterfaceType, graphql, printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import RelayPlugin from '../src';

function createBuilder() {
  const builder = new SchemaBuilder({
    plugins: [RelayPlugin],
    relay: {
      nodeTypeOptions: {
        name: 'Entity',
        description: 'From the builder options',
        extensions: { fromBuilder: true },
      },
    },
  });

  const Item = builder.objectRef<{ id: string }>('Item');

  builder.node(Item, {
    id: { resolve: (item) => item.id },
    loadOne: (id) => ({ id }),
    fields: (t) => ({ itemId: t.exposeString('id') }),
  });

  builder.queryType({});

  return builder;
}

describe('nodeInterfaceOptions', () => {
  it('keeps options it does not set and merges extensions', () => {
    const builder = createBuilder();

    const ref = builder.nodeInterfaceOptions({ extensions: { first: true } });
    builder.nodeInterfaceOptions({ description: undefined, extensions: { second: true } });

    const schema = builder.toSchema();
    const node = schema.getType('Entity') as GraphQLInterfaceType;

    expect(ref).toBe(builder.nodeInterfaceRef());
    expect(node.description).toBe('From the builder options');
    expect(node.extensions).toMatchObject({ fromBuilder: true, first: true, second: true });
  });

  it('replaces options set in the builder options', () => {
    const builder = createBuilder();

    builder.nodeInterfaceOptions({ description: 'Set later' });

    expect(printSchema(builder.toSchema())).toContain('"""Set later"""\ninterface Entity');
  });

  it('keeps resolving node types', async () => {
    const builder = createBuilder();

    builder.nodeInterfaceOptions({ description: 'Set later' });

    const result = await graphql({
      schema: builder.toSchema(),
      contextValue: {},
      source: `{ node(id: "${Buffer.from('Item:1').toString('base64')}") { ... on Item { itemId } } }`,
    });

    expect(result).toEqual({ data: { node: { itemId: '1' } } });
  });
});
