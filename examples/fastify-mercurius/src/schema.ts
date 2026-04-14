import { builder } from './builder.ts';

interface IUser {
  id: string;
  firstName: string;
  lastName: string;
}

const users: IUser[] = [
  { id: '1', firstName: 'Ada', lastName: 'Lovelace' },
  { id: '2', firstName: 'Alan', lastName: 'Turing' },
];

const User = builder.objectRef<IUser>('User').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    fullName: t.string({
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      args: {
        name: t.arg.string(),
      },
      resolve: (_root, { name }) => `Hello, ${name ?? 'world'}!`,
    }),
    users: t.field({
      type: [User],
      resolve: () => users,
    }),
    user: t.field({
      type: User,
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_root, args) => users.find((u) => u.id === String(args.id)),
    }),
  }),
});

export const schema = builder.toSchema();
