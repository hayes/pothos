import {
  GraphQLID,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql';
import builder from '../builder';

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
    bio: {
      type: Profile,
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

const UserRef = builder.addGraphQLObject(User, {
  name: 'AddedUser',
});
const PostRef = builder.addGraphQLObject<{ id: string; title: string; content: string }>(Post, {
  fields: (t) => ({
    // remove title field
    title: null,
    // replace with postTitle
    postTitle: t.exposeString('title'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: UserRef,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_, args) => ({
        id: String(args.id),
        name: 'User name',
      }),
    }),
    posts: t.field({
      type: [PostRef],
      resolve: () => [{ id: '123', title: 'title', content: 'content' }],
    }),
  }),
});

export default builder.toSchema();
