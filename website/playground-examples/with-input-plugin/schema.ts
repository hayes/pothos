import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';

const builder = new SchemaBuilder({
  plugins: [WithInputPlugin],
  withInput: {
    typeOptions: {
      // default options for Input object types
    },
  },
});

// User type
const User = builder.objectRef<{
  id: string;
  username: string;
  email: string;
  age: number;
}>('User');

builder.objectType(User, {
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    email: t.exposeString('email'),
    age: t.exposeInt('age'),
  }),
});

// Post type
const Post = builder.objectRef<{
  id: string;
  title: string;
  content: string;
  authorId: string;
}>('Post');

builder.objectType(Post, {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    authorId: t.exposeID('authorId'),
  }),
});

// Query
builder.queryType({
  fields: (t) => ({
    // Simple field with input
    findUser: t.fieldWithInput({
      input: {
        id: t.input.id({ required: true }),
      },
      type: User,
      nullable: true,
      resolve: (_, args) => {
        // The input is automatically under args.input
        if (args.input.id === '1') {
          return {
            id: '1',
            username: 'johndoe',
            email: 'john@example.com',
            age: 30,
          };
        }
        return null;
      },
    }),

    // Field with multiple input fields
    searchUsers: t.fieldWithInput({
      input: {
        username: t.input.string(),
        email: t.input.string(),
        minAge: t.input.int(),
        maxAge: t.input.int(),
      },
      type: [User],
      resolve: (_, args) => {
        // Mock search - in production this would query a database
        return [
          {
            id: '1',
            username: 'johndoe',
            email: 'john@example.com',
            age: 30,
          },
          {
            id: '2',
            username: 'janedoe',
            email: 'jane@example.com',
            age: 28,
          },
        ].filter((user) => {
          if (args.input.username && !user.username.includes(args.input.username)) {
            return false;
          }
          if (args.input.email && !user.email.includes(args.input.email)) {
            return false;
          }
          if (
            args.input.minAge !== undefined &&
            args.input.minAge !== null &&
            user.age < args.input.minAge
          ) {
            return false;
          }
          if (
            args.input.maxAge !== undefined &&
            args.input.maxAge !== null &&
            user.age > args.input.maxAge
          ) {
            return false;
          }
          return true;
        });
      },
    }),

    // Custom input type name and arg name
    findPost: t.fieldWithInput({
      typeOptions: {
        name: 'FindPostInput',
      },
      argOptions: {
        name: 'criteria',
      },
      input: {
        id: t.input.id({ required: true }),
      },
      type: Post,
      nullable: true,
      resolve: (_, args) => {
        // Now the input is under args.criteria instead of args.input
        if (args.criteria.id === '1') {
          return {
            id: '1',
            title: 'Getting Started with Pothos',
            content: 'Learn how to build type-safe GraphQL schemas',
            authorId: '1',
          };
        }
        return null;
      },
    }),
  }),
});

// Mutation
builder.mutationType({
  fields: (t) => ({
    // Create user with input
    createUser: t.fieldWithInput({
      input: {
        username: t.input.string({ required: true }),
        email: t.input.string({ required: true }),
        password: t.input.string({ required: true }),
        age: t.input.int({ required: true }),
      },
      type: User,
      resolve: (_, args) => {
        return {
          id: '3',
          username: args.input.username,
          email: args.input.email,
          age: args.input.age,
        };
      },
    }),

    // Update user with input
    updateUser: t.fieldWithInput({
      input: {
        id: t.input.id({ required: true }),
        username: t.input.string(),
        email: t.input.string(),
        age: t.input.int(),
      },
      type: User,
      resolve: (_, args) => {
        return {
          id: args.input.id,
          username: args.input.username || 'updated_user',
          email: args.input.email || 'updated@example.com',
          age: args.input.age ?? 25,
        };
      },
    }),

    // Create post with input
    createPost: t.fieldWithInput({
      input: {
        title: t.input.string({ required: true }),
        content: t.input.string({ required: true }),
        authorId: t.input.id({ required: true }),
      },
      type: Post,
      resolve: (_, args) => {
        return {
          id: '2',
          title: args.input.title,
          content: args.input.content,
          authorId: args.input.authorId,
        };
      },
    }),
  }),
});

export const schema = builder.toSchema();
