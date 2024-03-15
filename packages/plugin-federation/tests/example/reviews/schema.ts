import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '../../../src';

const builder = new SchemaBuilder({
  plugins: [DirectivesPlugin, FederationPlugin],
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
});

interface Review {
  id: string;
  authorID: string;
  product: {
    upc: string;
  };
  body: string;
}

interface User {
  id: string;
  username: string;
}

const usernames: User[] = [
  { id: '1', username: '@ada' },
  { id: '2', username: '@complete' },
];
const reviews: Review[] = [
  {
    id: '1',
    authorID: '1',
    product: { upc: '1' },
    body: 'Love it!',
  },
  {
    id: '2',
    authorID: '1',
    product: { upc: '2' },
    body: 'Too expensive.',
  },
  {
    id: '3',
    authorID: '2',
    product: { upc: '3' },
    body: 'Could be better.',
  },
  {
    id: '4',
    authorID: '2',
    product: { upc: '1' },
    body: 'Prefer something else.',
  },
];

const ReviewType = builder.objectRef<Review>('Review');

const Product = builder
  .externalRef('Product', builder.selection<{ upc: string }>('upc'))
  .implement({
    fields: (t) => ({
      upc: t.exposeString('upc'),
      reviews: t.field({
        type: [ReviewType],
        deprecationReason: 'test',
        tag: 'test',
        resolve: ({ upc }) => reviews.filter((review) => review.product.upc === upc),
      }),
    }),
  });

const UserType = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
  externalFields: (t) => ({
    username: t.string(),
  }),
  fields: (t) => ({
    id: t.exposeID('id'),
    reviews: t.field({
      type: [ReviewType],
      resolve: ({ id }) => reviews.filter((review) => review.authorID === id),
    }),
  }),
});

ReviewType.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    author: t.field({
      type: UserType.provides<{ username: string }>('username'),
      resolve: (review) => ({
        id: review.authorID,
        username: usernames.find((username) => username.id === review.authorID)!.username,
      }),
    }),
    product: t.field({
      type: Product,
      resolve: (review) => ({ upc: review.product.upc }),
    }),
  }),
});

builder.asEntity(ReviewType, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => reviews.find((review) => review.id === id),
});

export const schema = builder.toSubGraphSchema({});
