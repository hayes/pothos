import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '../../../src';

const builder = new SchemaBuilder({
  plugins: [DirectivesPlugin, FederationPlugin],
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
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

export const schema = builder.toSubGraphSchema({});
