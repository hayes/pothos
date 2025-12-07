import SchemaBuilder from '@pothos/core';

class User {
  id: string;
  firstName: string;
  username: string;

  constructor(id: string, firstName: string, username: string) {
    this.id = id;
    this.firstName = firstName;
    this.username = username;
  }
}

const builder = new SchemaBuilder<{
  Context: {
    currentUser: User;
  };
}>({});

builder.queryType({
  fields: (t) => ({
    currentUser: t.field({
      type: User,
      resolve: (_root, _args, context) => context.currentUser,
    }),
  }),
});

builder.objectType(User, {
  name: 'User',
  fields: (t) => ({
    id: t.exposeID('id', {}),
    firstName: t.exposeString('firstName', {}),
    username: t.exposeString('username', {}),
  }),
});

export const schema = builder.toSchema();
