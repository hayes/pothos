import builder from '../builder';

builder.queryType({
  permissions: {
    readUser: (parent, context) => context.role === 'Admin' || context.role === 'User',
  },
  fields: (t) => ({
    user: t.field({
      type: 'User',
      args: {
        id: t.arg.id({
          required: true,
        }),
      },
      // require a passing readUser auth check
      permissionCheck: 'readUser',
      grantPermissions: () => ({
        // grant readUserField auth for returned user
        readUserField: true,
      }),
      resolve: (parent, { id }, { User }) => {
        const user = User.map.get(Number.parseInt(id, 10));

        if (!user) {
          throw new Error(`User with id ${id} was not found`);
        }

        return user;
      },
    }),
    users: t.field({
      type: ['User'],
      // require a passing readUser auth check
      permissionCheck: 'readUser',
      grantPermissions: () => ({
        // grant readUserField auth for returned user
        readUserField: true,
      }),
      nullable: { list: false, items: true },
      resolve: (parent, args, { User }) => {
        const user1 = User.map.get(1);
        const user2 = User.map.get(2);

        return [user1, user2];
      },
    }),
  }),
});
