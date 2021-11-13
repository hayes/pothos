import SchemaBuilder from '@giraphql/core';
import DirectivesPlugin from '@giraphql/plugin-directives';
import FederationPlugin from '../../../src';

const builder = new SchemaBuilder<{}>({
  plugins: [DirectivesPlugin, FederationPlugin],
  useGraphQLToolsUnorderedDirectives: true,
});

interface Product {
  upc: string;
  inStock: boolean;
}

const inventory: Product[] = [
  { upc: '1', inStock: true },
  { upc: '2', inStock: false },
  { upc: '3', inStock: true },
];

builder.externalEntity('Product', {
  key: builder.selection<{ upc: string }>('upc'),
  resolveReference: ({ upc }: { upc: string }) => inventory.find((product) => product.upc === upc),
  externalFields: (t) => ({
    upc: t.string(),
    price: t.float(),
    weight: t.float(),
  }),
  fields: (t) => ({
    inStock: t.exposeBoolean('inStock'),
    shippingEstimate: t.float({
      requires: builder.selection<{ weight: number; price: number }>('price weight'),
      resolve: ({ weight, price }) => {
        // free for expensive items
        if (price > 1000) {
          return 0;
        }
        // estimate is based on weight
        return weight * 0.5;
      },
    }),
  }),
});
