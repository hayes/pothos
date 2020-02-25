import builder from '../builder';

export default builder.objectType('User', {
  defaultPermissionCheck: 'readUserField',
  preResolveCheck: context => {
    if (!context.user || context.user.id > 2) {
      return false;
    }

    return {
      readUserId: context.user.id === 1,
    };
  },
  permissions: {
    readEmail: parent => !!(parent.id % 2),
  },
  shape: t => ({
    id: t.exposeID('id', {
      permissionsCheck: ['readUserId'],
    }),
    firstName: t.exposeString('firstName', {}),
    lastName: t.exposeString('lastName', {
      permissionsCheck: (parent, args, { user }) => parent.lastName === user?.lastName,
    }),
    email: t.exposeString('email', {
      permissionsCheck: 'readEmail',
    }),
  }),
});
