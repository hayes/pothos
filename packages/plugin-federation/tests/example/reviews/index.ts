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
        resolve: ({ upc }) => reviews.filter((review) => review.product.upc === upc),
      }),
    }),
  });

const UserType = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
  fields: (t) => ({
    id: t.exposeID('id'),
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
    product: t.field({
      type: Product,
      resolve: (review) => ({ __typename: 'Product' as const, upc: review.product.upc }),
    }),
  }),
});

const server = new ApolloServer({
  schema: builder.toSubGraphSchema({}),
});

server
  .listen(4004)
  .then(({ url }) => void console.log(`accounts server started at ${url}`))
  .catch((error: unknown) => {
    throw error;
  });
