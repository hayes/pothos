import builder from '../builder';

export default builder.objectType('User', {
  defaultAuthChecks: ['readUserField'],
  preResolveAuthCheck: context => {
    if (!context.user || context.user.id > 2) {
      return false;
    }

    return {
      readUserId: context.user.id === 1,
    };
  },
  authChecks: {
    readEmail: parent => !!(parent.id % 2),
  },
  shape: t => ({
    id: t.exposeID('id', {
      checkAuth: ['readUserId'],
    }),
    firstName: t.exposeString('firstName', {}),
    lastName: t.exposeString('lastName', {
      checkAuth: (parent, args, { user }) => parent.lastName === user?.lastName,
    }),
    email: t.exposeString('email', {
      checkAuth: ['readEmail'],
    }),
  }),
});
