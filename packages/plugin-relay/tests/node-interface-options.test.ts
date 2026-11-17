import SchemaBuilder from '@pothos/core';
import { type GraphQLInterfaceType, graphql } from 'graphql';
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

describe('nodeInterfaceRef options', () => {
  it('keeps options it does not set and merges extensions', () => {
    const builder = createBuilder();

    const ref = builder.nodeInterfaceRef({ extensions: { first: true } });
    builder.nodeInterfaceRef({ description: undefined, extensions: { second: true } });

    const schema = builder.toSchema();
    const node = schema.getType('Entity') as GraphQLInterfaceType;

    expect(ref).toBe(builder.nodeInterfaceRef());
    expect(node.description).toBe('From the builder options');
    expect(node.extensions).toMatchObject({ fromBuilder: true, first: true, second: true });
  });

  it('sets options not set in the builder options, including relay defaults', async () => {
    const builder = createBuilder();

    builder.nodeInterfaceRef({ description: undefined, resolveType: () => 'Item' });
    builder.nodeInterfaceRef({ extensions: { later: true } });

    const schema = builder.toSchema();
    const node = schema.getType('Entity') as GraphQLInterfaceType;

    expect(node.description).toBe('From the builder options');
    expect(node.extensions).toMatchObject({ fromBuilder: true, later: true });

    const result = await graphql({
      schema,
      contextValue: {},
      source: `{ node(id: "${Buffer.from('Item:1').toString('base64')}") { __typename } }`,
    });

    expect(result).toEqual({ data: { node: { __typename: 'Item' } } });
  });

  it('throws when an option set in the builder options is set again', () => {
    const builder = createBuilder();

    expect(() => builder.nodeInterfaceRef({ description: 'Set later' })).toThrow(
      'Entity option "description" is already set',
    );
  });

  it('sets nothing from a call that throws', () => {
    const builder = createBuilder();

    expect(() =>
      builder.nodeInterfaceRef({ resolveType: () => 'Item', description: 'Set later' }),
    ).toThrow('Entity option "description" is already set');
    expect(() => builder.nodeInterfaceRef({ resolveType: () => 'Item' })).not.toThrow();
  });

  it('throws when an option is set by two calls', () => {
    const builder = createBuilder();

    builder.nodeInterfaceRef({ resolveType: () => 'Item' });

    expect(() => builder.nodeInterfaceRef({ resolveType: () => 'Item' })).toThrow(
      'Entity option "resolveType" is already set',
    );
  });

  it('keeps resolving node types', async () => {
    const builder = createBuilder();

    builder.nodeInterfaceRef({ extensions: { later: true } });

    const result = await graphql({
      schema: builder.toSchema(),
      contextValue: {},
      source: `{ node(id: "${Buffer.from('Item:1').toString('base64')}") { ... on Item { itemId } } }`,
    });

    expect(result).toEqual({ data: { node: { itemId: '1' } } });
  });
});
