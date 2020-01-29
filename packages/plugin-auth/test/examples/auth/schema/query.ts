import builder from '../builder';

export default builder.createQueryType({
  authChecks: {
    readUser: (parent, context) => {
      return context.role === 'Admin' || context.role === 'User';
    },
  },
  shape: t => ({
    user: t.field({
      type: 'User',
      args: {
        id: t.arg('ID', {
          required: true,
        }),
      },
      // require a passing readUser auth check
      checkAuth: ['readUser'],
      grantAuth: {
        // grant readUser auth for returned user
        readUserField: true,
        readUserId: parent => parent.id === 1,
      },
      resolve: (parent, { id }, { User }) => {
        const user = User.map.get(parseInt(id, 10));

        if (!user) {
          throw new Error(`User with id ${id} was not found`);
        }

        return user;
      },
    }),
    users: t.field({
      type: ['User'],
      // require a passing readUser auth check
      checkAuth: ['readUser'],
      nullable: { list: false, items: true },
      grantAuth: {
        // grant readUser auth for returned user
        readUserField: true,
        readUserId: parent => parent.id === 1,
      },
      resolve: (parent, args, { User }) => {
        const user1 = User.map.get(1);
        const user2 = User.map.get(2);

        return [user1, user2];
      },
    }),
  }),
});
