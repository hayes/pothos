import SchemaBuilder from '@pothos/core';

interface IUser {
  id: number;
  name: string;
}

const Users = new Map<number, IUser>([
  [1, { id: 1, name: 'Alex Lin' }],
  [2, { id: 2, name: 'Sam Patel' }],
]);

// The Context shape is whatever your server attaches to every request.
// A typical one threads the authenticated user (if any) and any data
// sources the resolvers need.
interface Context {
  user?: { id: number };
  db: {
    users: { find: (id: number) => IUser | null };
  };
}

const builder = new SchemaBuilder<{
  Context: Context;
}>({});

const User = builder.objectRef<IUser>('User');

User.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: User,
      nullable: true,
      resolve: (_root, _args, ctx) => (ctx.user ? ctx.db.users.find(ctx.user.id) : null),
    }),
  }),
});

export const schema = builder.toSchema();
