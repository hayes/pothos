import { builder } from './builder';
import type { Post } from './types';
import { posts, users } from './types';

// Define the User type
builder.objectType('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    email: t.exposeString('email'),
    posts: t.field({
      type: ['Post'],
      resolve: (user) => user.posts,
    }),
  }),
});

// Define the Post type
builder.objectType('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    author: t.field({
      type: 'User',
      nullable: true,
      resolve: (post) => post.author || null,
    }),
  }),
});

// Define the Query type
builder.queryType({
  fields: (t) => ({
    users: t.field({
      type: ['User'],
      resolve: () => users,
    }),
    user: t.field({
      type: 'User',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_, { id }) => users.find((u) => u.id === id) || null,
    }),
    posts: t.field({
      type: ['Post'],
      resolve: () => posts,
    }),
    post: t.field({
      type: 'Post',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_, { id }) => posts.find((p) => p.id === id) || null,
    }),
  }),
});

// Define the Mutation type
builder.mutationType({
  fields: (t) => ({
    createPost: t.field({
      type: 'Post',
      args: {
        title: t.arg.string({ required: true }),
        content: t.arg.string({ required: true }),
        authorId: t.arg.id({ required: true }),
      },
      resolve: (_, { title, content, authorId }) => {
        const author = users.find((u) => u.id === authorId);
        if (!author) {
          throw new Error('Author not found');
        }

        const newPost: Post = {
          id: String(posts.length + 1),
          title,
          content,
          authorId,
          author,
        };

        posts.push(newPost);
        author.posts.push(newPost);

        return newPost;
      },
    }),
  }),
});

// Build and export the schema
export const schema = builder.toSchema();
