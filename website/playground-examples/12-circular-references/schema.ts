import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define backing types
interface IUser {
  id: string;
  name: string;
  email: string;
}

interface IPost {
  id: string;
  title: string;
  content: string;
  authorId: string;
}

// Create refs before implementing types
export const User = builder.objectRef<IUser>('User');
const Post = builder.objectRef<IPost>('Post');

// Mock data
const users: IUser[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
];

const posts: IPost[] = [
  { id: '1', title: 'First Post', content: 'Hello World', authorId: '1' },
  { id: '2', title: 'Second Post', content: 'GraphQL rocks', authorId: '1' },
  { id: '3', title: "Bob's Post", content: 'Hi there', authorId: '2' },
];

// Implement User type with circular reference to Post
builder.objectType(User, {
  fields: (t) => ({
    // Circular references here won't cause issues, because User is already defined above
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    email: t.exposeString('email'),
    // User has posts (circular reference)
    posts: t.field({
      type: [Post],
      resolve: (user) => posts.filter((post) => post.authorId === user.id),
    }),
  }),
});

// Implement Post type with circular reference to User
builder.objectType(Post, {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    // Post has author (circular reference)
    author: t.field({
      type: User,
      resolve: (post) => users.find((user) => user.id === post.authorId)!,
    }),
  }),
});

// Query type
builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: User,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_parent, args) => users.find((user) => user.id === args.id)!,
    }),
    post: t.field({
      type: Post,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_parent, args) => posts.find((post) => post.id === args.id)!,
    }),
    users: t.field({
      type: [User],
      resolve: () => users,
    }),
    posts: t.field({
      type: [Post],
      resolve: () => posts,
    }),
  }),
});

export const schema = builder.toSchema();
