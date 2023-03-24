import {
  GraphQLID,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql';
import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '../../../src';

const Node = new GraphQLInterfaceType({
  name: 'Node',
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
  }),
});

const User = new GraphQLObjectType<{ id: string; name: string; profile?: { bio?: string } }>({
  name: 'User',
  interfaces: [Node],
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: (parent) => parent.id,
    },
    name: {
      type: GraphQLString,
    },
    profile: {
      type: Profile,
      resolve: () => ({ bio: 'example bio' }),
    },
    posts: {
      type: new GraphQLList(new GraphQLNonNull(Post)),
      resolve: () => [{ id: '123', title: 'title', content: 'content' }],
    },
  }),
});

// profile automatically added because it's references through the Users profile field
const Profile = new GraphQLObjectType<{ bio?: string }>({
  name: 'Profile',
  interfaces: [Node],
  fields: () => ({
    bio: {
      type: GraphQLString,
    },
  }),
});

const Post = new GraphQLObjectType<{ id: string; title: string; content: string }>({
  name: 'Post',
  interfaces: [Node],
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: (parent) => parent.id,
    },
    title: {
      type: GraphQLString,
    },
    content: {
      type: GraphQLString,
    },
  }),
});

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      user: {
        type: User,
        args: {
          id: {
            type: new GraphQLNonNull(GraphQLID),
          },
        },
        resolve: (_, args) => ({
          id: String(args.id),
          name: 'User name',
        }),
      },
    }),
  }),
});

interface Types {
  Context: {};
  Scalars: {
    ID: {
      Input: string;
      Output: number | string;
    };
  };
  Objects: {
    Post: {};
  };
}

export const builder = new SchemaBuilder<Types>({
  plugins: [AddGraphQLPlugin],
  add: {
    schema,
  },
});
