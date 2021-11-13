import SchemaBuilder from '@giraphql/core';
import DirectivesPlugin from '@giraphql/plugin-directives';
import FederationPlugin from '../../../src';

const builder = new SchemaBuilder<{}>({
  plugins: [DirectivesPlugin, FederationPlugin],
  useGraphQLToolsUnorderedDirectives: true,
});

interface Product {
  upc: string;
  name: string;
  price: number;
  weight: number;
}

const products: Product[] = [
  {
    upc: '1',
    name: 'Table',
    price: 899,
    weight: 100,
  },
  {
    upc: '2',
    name: 'Couch',
    price: 1299,
    weight: 1000,
  },
  {
    upc: '3',
    name: 'Chair',
    price: 54,
    weight: 50,
  },
];

const ProductType = builder.entity(builder.objectRef<Product>('Product'), {
  key: builder.selection<{ upc: string }>('upc'),
  resolveReference: ({ upc }) => products.find((product) => product.upc === upc),
  fields: (t) => ({
    upc: t.exposeString('upc'),
    name: t.exposeString('name'),
    price: t.exposeFloat('price'),
    weight: t.exposeFloat('weight'),
  }),
});

builder.queryType({
  fields: (t) => ({
    topProducts: t.field({
      type: [ProductType],
      args: {
        first: t.arg.int({
          defaultValue: 5,
        }),
      },
      resolve: (root, args) => products.slice(0, args.first ?? 5),
    }),
  }),
});
