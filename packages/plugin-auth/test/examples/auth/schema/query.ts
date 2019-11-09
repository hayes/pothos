import builder from '../builder';

export default builder.createObjectType('Query', {
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
      authWith: ['readUser'],
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
