import SchemaBuilder from '@pothos/core';
import DirectivePlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';

const builder = new SchemaBuilder({
  // If you are using other plugins, the federation plugin should be listed after plugins like auth that wrap resolvers
  plugins: [DirectivePlugin, FederationPlugin],
});

// #region service
const inventory = [{ upc: '1', inStock: true }];

const Product = builder.externalRef(
  'Product',
  builder.selection<{ upc: string }>('upc'),
  (entity) => {
    const product = inventory.find(({ upc }) => upc === entity.upc);

    // extends the entity ({upc: string}) with other product details available in this service
    return product && { ...entity, ...product };
  },
);

Product.implement({
  // Additional external fields can be defined here which can be used by `requires` or `provides` directives
  externalFields: (t) => ({
    price: t.float(),
    weight: t.float(),
  }),
  fields: (t) => ({
    // exposes properties added during loading of the entity above
    upc: t.exposeString('upc'),
    inStock: t.exposeBoolean('inStock'),
    shippingEstimate: t.float({
      // fields can add a `requires` directive for any of the externalFields defined above
      // which will be made available as part of the first arg in the resolver.
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
// #endregion service
builder.queryType({ fields: (t) => ({ service: t.string({ resolve: () => 'inventory' }) }) });
export const schema = builder.toSubGraphSchema({});
