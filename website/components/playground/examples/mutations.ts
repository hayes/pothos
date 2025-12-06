import type { PlaygroundExample } from '../types';

export const mutationsExample: PlaygroundExample = {
  id: 'mutations',
  title: 'Mutations',
  description: 'Define mutations with input types',
  files: [
    {
      filename: 'schema.ts',
      content: `import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Simple in-memory store
const users = new Map<string, { id: string; name: string; email: string }>();

// User type ref
const UserType = builder.objectRef<{ id: string; name: string; email: string }>('User');

builder.objectType(UserType, {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    email: t.exposeString('email'),
  }),
});

// Input type for creating users
const CreateUserInput = builder.inputType('CreateUserInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    email: t.string({ required: true }),
  }),
});

builder.queryType({
  fields: (t) => ({
    users: t.field({
      type: [UserType],
      resolve: () => Array.from(users.values()),
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createUser: t.field({
      type: UserType,
      args: {
        input: t.arg({ type: CreateUserInput, required: true }),
      },
      resolve: (_, { input }) => {
        const id = String(users.size + 1);
        const user = { id, ...input };
        users.set(id, user);
        return user;
      },
    }),
    deleteUser: t.boolean({
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_, { id }) => users.delete(String(id)),
    }),
  }),
});

export const schema = builder.toSchema();`,
    },
  ],
  defaultQuery: `mutation {
  createUser(input: {
    name: "Jane Doe"
    email: "jane@example.com"
  }) {
    id
    name
    email
  }
}`,
};
