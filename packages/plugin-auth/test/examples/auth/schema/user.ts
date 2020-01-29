import builder from '../builder';

export default builder.createObjectType('User', {
  defaultAuthChecks: ['readUserField'],
  authChecks: {
    readEmail: parent => !!(parent.id % 2),
  },
  shape: t => ({
    id: t.exposeID('id', {
      checkAuth: ['readUserId'],
    }),
    firstName: t.exposeString('firstName', {}),
    lastName: t.exposeString('lastName', {
      checkAuth: [(parent, { user }) => parent.lastName === user?.lastName],
    }),
    email: t.exposeString('email', {
      checkAuth: ['readEmail'],
    }),
  }),
});
