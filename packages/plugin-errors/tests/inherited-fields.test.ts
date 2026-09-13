import SchemaBuilder from '@pothos/core';
import { type GraphQLObjectType, graphql, validateSchema } from 'graphql';
import ErrorsPlugin from '../src';

it('shares generated error result types across inherited interface fields', async () => {
  const builder = new SchemaBuilder({ plugins: [ErrorsPlugin] });
  builder.objectType(Error, {
    name: 'Error',
    fields: (t) => ({ message: t.exposeString('message') }),
  });
  const base = builder.interfaceRef<{ fail: boolean }>('Base').implement({
    fields: (t) => ({
      value: t.string({
        errors: { types: [Error] },
        resolve: ({ fail }) => {
          if (fail) {
            throw new Error('denied');
          }
          return 'ok';
        },
      }),
      items: t.stringList({
        itemErrors: { types: [Error] },
        resolve: () => ['ok', Promise.reject(new Error('item'))],
      }),
    }),
  });
  const middle = builder
    .interfaceRef<{ fail: boolean }>('Middle')
    .implement({ interfaces: [base] });
  const first = builder
    .objectRef<{ fail: boolean }>('First')
    .implement({ interfaces: [middle, base] });
  const second = builder.objectRef<{ fail: boolean }>('Second').implement({ interfaces: [base] });
  builder.queryType({
    fields: (t) => ({
      first: t.field({ type: first, resolve: () => ({ fail: false }) }),
      second: t.field({ type: second, resolve: () => ({ fail: true }) }),
    }),
  });
  for (let build = 0; build < 2; build += 1) {
    const schema = builder.toSchema();
    expect(validateSchema(schema)).toEqual([]);
    for (const name of ['Base', 'Middle', 'First', 'Second']) {
      const fields = (schema.getType(name) as GraphQLObjectType).getFields();
      expect(String(fields.value.type)).toBe('BaseValueResult');
      expect(String(fields.items.type)).toBe('[BaseItemsItemResult!]');
    }
    const result = await graphql({
      schema,
      source:
        '{ first { value { ... on BaseValueSuccess { data } } items { ... on BaseItemsItemSuccess { data } ... on Error { message } } } second { value { ... on Error { message } } } }',
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      first: { value: { data: 'ok' }, items: [{ data: 'ok' }, { message: 'item' }] },
      second: { value: { message: 'denied' } },
    });
  }
});
