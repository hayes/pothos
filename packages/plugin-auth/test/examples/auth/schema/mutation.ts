import builder from '../builder';

export default builder.mutationType({
  shape: (t) => ({
    createUser: t.field({
      type: 'User',
      args: {
        firstName: t.arg('String', {
          required: true,
        }),
        lastName: t.arg.string({
          required: true,
        }),
      },
      permissionCheck: (parent, args, { role }) => role === 'Admin',
      resolve: (parent, { firstName, lastName }, { User }) => {
        const user = User.create(firstName, lastName, 'User');

        return user;
      },
    }),
  }),
});
