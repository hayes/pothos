import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';

const builder = new SchemaBuilder({
  plugins: [RelayPlugin],
  relay: {},
});

// Or using a class
class User {
  id: string;
  name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }
}

const users = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  { id: '3', name: 'Charlie' },
];

const loadUserByID = (id: string) => users.find((user) => user.id === id) ?? null;
const loadUsers = (ids: string[]) => ids.map((id) => loadUserByID(id)).filter(Boolean);

builder.node(User, {
  // define an id field
  id: {
    resolve: (user) => user.id,
    // other options for id field can be added here
  },

  // Define only one of the following methods for loading nodes by id
  loadOne: (id) => loadUserByID(id),
  loadMany: (ids) => loadUsers(ids),
  loadWithoutCache: (id) => loadUserByID(id),
  loadManyWithoutCache: (ids) => loadUsers(ids),

  // if using a class instaed of a ref, you will need to provide a name
  name: 'User',
  fields: (t) => ({
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: User,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_parent, args) => loadUserByID(args.id),
    }),
    users: t.connection({
      type: User,
      resolve: () => {
        // Simple array-based connection resolver
        return {
          edges: users.map((user, index) => ({
            cursor: String(index),
            node: user,
          })),
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: '0',
            endCursor: String(users.length - 1),
          },
        };
      },
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createUser: t.field({
      type: User,
      args: {
        name: t.arg.string({ required: true }),
        email: t.arg.string({ required: true }),
      },
      resolve: (_parent, args) => {
        const newUser = { id: String(users.length + 1), name: args.name };
        users.push(newUser);
        return newUser;
      },
    }),
  }),
});

export const schema = builder.toSchema();
