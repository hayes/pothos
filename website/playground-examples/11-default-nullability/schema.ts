import SchemaBuilder from '@pothos/core';

interface User {
  id: string;
  username: string;
  email: string;
  bio: string | null;
}

// Create a Builder that makes output fields non-nullable by default
const builder = new SchemaBuilder<{
  DefaultFieldNullability: false;
  Objects: {
    User: User;
  };
}>({
  defaultFieldNullability: false,
});

const users: User[] = [
  {
    id: '1',
    username: 'alice',
    email: 'alice@example.com',
    bio: 'Software engineer',
  },
  {
    id: '2',
    username: 'bob',
    email: 'bob@example.com',
    bio: null,
  },
];

builder.objectType('User', {
  fields: (t) => ({
    // These fields are non-nullable by default (thanks to defaultFieldNullability: false)
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    email: t.exposeString('email'),

    // Explicitly mark nullable fields
    bio: t.exposeString('bio', {
      nullable: true,
    }),

    // Computed field is also non-nullable by default
    displayName: t.string({
      resolve: (user) => `@${user.username}`,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Field is non-nullable by default
    users: t.field({
      type: ['User'],
      resolve: () => users,
    }),

    // Must explicitly set nullable: true if field can return null
    user: t.field({
      type: 'User',
      nullable: true,
      args: {
        id: t.arg.string(),
      },
      resolve: (_parent, { id }) => users.find((u) => u.id === id) || null,
    }),
  }),
});

export const schema = builder.toSchema();
