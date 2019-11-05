import builder from '../builder';

export default builder.createObjectType('Mutation', {
  shape: t => ({
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
      resolve: (parent, { firstName, lastName }, { User }) => {
        const user = User.create(firstName, lastName, 'User');

        return user;
      },
    }),
  }),
});
