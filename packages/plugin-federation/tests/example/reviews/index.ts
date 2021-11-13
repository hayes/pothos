import SchemaBuilder from '@giraphql/core';
import DirectivesPlugin from '@giraphql/plugin-directives';
import FederationPlugin from '../../../src';

const builder = new SchemaBuilder<{}>({
  plugins: [DirectivesPlugin, FederationPlugin],
  useGraphQLToolsUnorderedDirectives: true,
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

builder.externalEntity('Product', {
  key: builder.selection<{ upc: string }>('upc'),
  externalFields: (t) => ({
    upc: t.string(),
  }),
  fields: (t) => ({
    reviews: t.field({
      type: [ReviewType],
      resolve: ({ upc }) => reviews.filter((review) => review.product.upc === upc),
    }),
  }),
});

const UserType = builder.externalEntity('User', {
  key: builder.selection<{ id: string }>('id'),
  externalFields: (t) => ({
    id: t.id(),
    username: t.string(),
  }),
  fields: (t) => ({
    reviews: t.field({
      type: [ReviewType],
      resolve: ({ id }) => reviews.filter((review) => review.authorID === id),
    }),
    username: t.string({
      nullable: true,
      resolve: (user) => {
        const found = usernames.find((username) => username.id === user.id);

        return found ? found.username : null;
      },
    }),
  }),
});

builder.entity(ReviewType, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => reviews.find((review) => review.id === id),
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    author: t.field({
      type: UserType,
      provides: builder.selection<{ username: string }>('username'),
      resolve: (review) => ({
        __typename: 'User' as const,
        id: review.authorID,
        // TODO what to do with provides defined on type not parent field
        username: '',
      }),
    }),
  }),
});
