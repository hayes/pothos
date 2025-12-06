import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define an interface
const Node = builder.interfaceRef<{ id: string }>('Node');

builder.interfaceType(Node, {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

// Types implementing the interface
type UserShape = { id: string; name: string; email: string };
type PostShape = { id: string; title: string; content: string };

const User = builder.objectRef<UserShape>('User');
const Post = builder.objectRef<PostShape>('Post');

builder.objectType(User, {
  interfaces: [Node],
  fields: (t) => ({
    name: t.exposeString('name'),
    email: t.exposeString('email'),
  }),
});

builder.objectType(Post, {
  interfaces: [Node],
  fields: (t) => ({
    title: t.exposeString('title'),
    content: t.exposeString('content'),
  }),
});

// Union type
const SearchResult = builder.unionType('SearchResult', {
  types: [User, Post],
  resolveType: (value) => {
    if ('email' in value) return User;
    return Post;
  },
});

builder.queryType({
  fields: (t) => ({
    node: t.field({
      type: Node,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_, { id }) => ({ id: String(id), name: 'Test', email: 'test@example.com' }),
    }),
    search: t.field({
      type: [SearchResult],
      args: { query: t.arg.string({ required: true }) },
      resolve: () => [
        { id: '1', name: 'John', email: 'john@example.com' },
        { id: '2', title: 'Hello World', content: 'Welcome!' },
      ],
    }),
  }),
});

export const schema = builder.toSchema();