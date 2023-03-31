import { DirectiveLocation, GraphQLDirective } from 'graphql';
import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '../../../src';

const builder = new SchemaBuilder<{
  Directives: {
    custom: {
      locations: 'INTERFACE' | 'OBJECT';
      args: {};
    };
    link: {
      locations: 'SCHEMA';
      args: {
        url: string;
        import: string[];
      };
    };
  };
}>({
  plugins: [DirectivesPlugin, FederationPlugin],
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
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

const Media = builder.interfaceRef<{ id: string }>('Media').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Post = builder.objectRef<{ id: string; title: string }>('Post').implement({
  interfaces: [Media],
  fields: (t) => ({
    title: t.exposeString('title'),
  }),
});

const ProductType = builder.objectRef<Product>('Product').implement({
  directives: {
    custom: {},
  },
  fields: (t) => ({
    upc: t.exposeString('upc'),
    name: t.exposeString('name'),
    price: t.exposeFloat('price'),
    weight: t.exposeFloat('weight'),
  }),
});

builder.asEntity(ProductType, {
  key: builder.selection<{ upc: string }>('upc'),
  resolveReference: ({ upc }) => products.find((product) => product.upc === upc),
});

builder.asEntity(Media, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => ({ id, __typename: 'Post', title: 'Title' }),
});

builder.asEntity(Post, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => ({ id, title: 'Title' }),
});

builder.queryField('post', (t) =>
  t.field({
    type: Post,
    resolve: () => ({
      id: '123',
      title: 'Title',
    }),
  }),
);

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

export const schema = builder.toSubGraphSchema({
  composeDirectives: ['@custom'],
  schemaDirectives: {
    link: { url: 'https://myspecs.dev/myCustomDirective/v1.0', import: ['@custom'] },
  },
  directives: [
    new GraphQLDirective({
      locations: [DirectiveLocation.OBJECT, DirectiveLocation.INTERFACE],
      name: 'custom',
    }),
  ],
});
