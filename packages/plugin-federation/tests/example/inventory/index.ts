import { ApolloServer } from 'apollo-server';
import SchemaBuilder from '@giraphql/core';
import DirectivesPlugin from '@giraphql/plugin-directives';
import FederationPlugin from '../../../src';

const builder = new SchemaBuilder<{
  DefaultFieldNullability: true;
}>({
  plugins: [DirectivesPlugin, FederationPlugin],
  useGraphQLToolsUnorderedDirectives: true,
  defaultFieldNullability: true,
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

const ProductRef = builder.externalRef(
  'Product',
  builder.selection<{ upc: string }>('upc'),
  (entity) => {
    const product = inventory.find(({ upc }) => upc === entity.upc);

    return product && { ...entity, ...product };
  },
);

ProductRef.implement({
  externalFields: (t) => ({
    price: t.float(),
    weight: t.float(),
  }),
  fields: (t) => ({
    upc: t.exposeString('upc'),
    inStock: t.exposeBoolean('inStock'),
    shippingEstimate: t.float({
      requires: builder.selection<{ weight?: number; price?: number }>('price weight'),
      resolve: (data) => {
        // free for expensive items
        if ((data.price ?? 0) > 1000) {
          return 0;
        }
        // estimate is based on weight
        return (data.weight ?? 0) * 0.5;
      },
    }),
  }),
});

const server = new ApolloServer({
  schema: builder.toSubGraphSchema({}),
});

server
  .listen(4002)
  .then(({ url }) => void console.log(`accounts server started at ${url}`))
  .catch((error: unknown) => {
    throw error;
  });
