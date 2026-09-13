import SchemaBuilder from '@pothos/core';
import {
  buildSchema,
  type GraphQLInputObjectType,
  type GraphQLInterfaceType,
  type GraphQLObjectType,
  graphql,
} from 'graphql';
import AddGraphQLPlugin from '../src';

it('imports prototype-named fields on objects, interfaces, and inputs', async () => {
  const original = buildSchema(`
    interface Named { toString: String }
    type Item implements Named { toString: String }
    input Filter { constructor: String hasOwnProperty: String }
    type Query { item(filter: Filter): Item }
  `);
  original.getQueryType()!.getFields().item.resolve = (_, { filter }) => ({
    toString: `${filter.constructor}:${filter.hasOwnProperty}`,
  });
  const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin], add: { schema: original } });
  const schema = builder.toSchema();

  expect((schema.getType('Named') as GraphQLInterfaceType).getFields()).toHaveProperty('toString');
  expect(
    await graphql({
      schema,
      source: '{ item(filter: { constructor: "a", hasOwnProperty: "b" }) { toString } }',
    }),
  ).toEqual({ data: { item: { toString: 'a:b' } } });
});

it('honors explicit replacement and removal of prototype-named fields', () => {
  const original = buildSchema(`
    interface Named { toString: String constructor: String }
    type Item implements Named { toString: String constructor: String }
    input Filter { toString: String constructor: String }
    type Query { item: Item }
  `);
  const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin] });
  builder.addGraphQLInterface(original.getType('Named') as GraphQLInterfaceType, {
    fields: (t) => ({ toString: t.string({ description: 'replacement' }), constructor: null }),
  });
  const Item = builder.addGraphQLObject<{}>(original.getType('Item') as GraphQLObjectType, {
    fields: (t) => ({ toString: t.string({ resolve: () => 'replacement' }), constructor: null }),
  });
  const Filter = builder.addGraphQLInput<{}>(original.getType('Filter') as GraphQLInputObjectType, {
    fields: (t) => ({ toString: t.string({ description: 'replacement' }), constructor: null }),
  });
  builder.queryType({
    fields: (t) => ({
      item: t.field({ type: Item, args: { filter: t.arg({ type: Filter }) }, resolve: () => ({}) }),
    }),
  });
  const schema = builder.toSchema();
  for (const name of ['Named', 'Item', 'Filter']) {
    expect(Object.keys((schema.getType(name) as GraphQLObjectType).getFields())).toEqual([
      'toString',
    ]);
  }
});
