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
      authWith: ['readUser'],
      grantAuth: {
        // grant readUser auth for returned user
        readUserField: true,
      },
      resolve: (parent, { id }, { User }) => {
        const user = User.map.get(parseInt(id, 10));

        if (!user) {
          throw new Error(`User with id ${id} was not found`);
        }

        return user;
      },
    }),
  }),
});
