import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';

export const builder = new SchemaBuilder<{
  Scalars: {
    ID: { Input: string; Output: number | string };
  };
}>({
  plugins: [DirectivesPlugin, FederationPlugin],
});

// type Review {
//   id: ID!
//   rating: Float!
//   content: String!
// }
// type Product @key(fields: "id") {
//   id: ID!
//   reviews: [Review!]!
// }

interface Review {
  id: string;
  productId: string;
  rating: number;
  content: string;
}

const reviews: Review[] = [
  {
    id: '1',
    productId: '1',
    content: 'The best blender',
    rating: 4.5,
  },
];

const ReviewType = builder.objectRef<Review>('Review');

ReviewType.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    rating: t.exposeFloat('rating'),
    content: t.exposeString('content'),
    product: t.field({
      type: ProductType,
      resolve: (review) => ({ id: review.productId }),
    }),
  }),
});

const ProductType = builder.objectRef<{ id: string }>('Product');

ProductType.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    reviews: t.field({
      type: [ReviewType],
      resolve: (product) => reviews.filter((review) => review.productId === product.id),
    }),
  }),
});

builder.asEntity(ProductType, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: (product) => product,
});

builder.queryType({
  fields: (t) => ({
    review: t.field({
      type: ReviewType,
      nullable: true,
      args: {
        id: t.arg.id(),
      },
      resolve: (_, { id }) => reviews.find((review) => review.id === id),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
