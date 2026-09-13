import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import RelayPlugin from '../src';

it.each([
  false,
  true,
])('resolves promised edges for connection nodes (non-null: %s)', async (nonNull) => {
  const builder = new SchemaBuilder({ plugins: [RelayPlugin], relay: { nodesOnConnection: true } });
  const Item = builder.objectRef<{ value: number }>('Item').implement({
    fields: (t) => ({ value: t.exposeInt('value') }),
  });
  builder.queryType({
    fields: (t) => ({
      items: t.connection({
        type: Item,
        edgesNullable: nonNull ? { list: false, items: false } : { list: true, items: true },
        nodeNullable: !nonNull,
        resolve: () => ({
          edges: [
            Promise.resolve({ cursor: 'a', node: { value: 1 } }),
            { cursor: 'b', node: { value: 2 } },
          ],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        }),
      }),
    }),
  });
  const result = await graphql({
    schema: builder.toSchema(),
    source: '{ items { edges { node { value } } nodes { value } } }',
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({
    items: {
      edges: [{ node: { value: 1 } }, { node: { value: 2 } }],
      nodes: [{ value: 1 }, { value: 2 }],
    },
  });
});

it('preserves nullable edges and per-item rejected promises', async () => {
  const builder = new SchemaBuilder({ plugins: [RelayPlugin], relay: { nodesOnConnection: true } });
  const Item = builder
    .objectRef<{ value: number }>('Item')
    .implement({ fields: (t) => ({ value: t.exposeInt('value') }) });
  builder.queryType({
    fields: (t) => ({
      items: t.connection({
        type: Item,
        edgesNullable: { list: false, items: true },
        resolve: () => ({
          edges: [
            null,
            Promise.resolve(null),
            Promise.reject(new Error('missing')),
            Promise.resolve({ cursor: 'a', node: { value: 1 } }),
          ],
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
        }),
      }),
    }),
  });
  const result = await graphql({
    schema: builder.toSchema(),
    source: '{ items { nodes { value } } }',
    contextValue: {},
  });
  expect(result.data).toEqual({ items: { nodes: [null, null, null, { value: 1 }] } });
  expect(result.errors).toHaveLength(1);
  expect(result.errors?.[0].path).toEqual(['items', 'nodes', 2]);
});
