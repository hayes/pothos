import builder from '../builder';

export default builder.createObjectType('User', {
  shape: t => ({
    id: t.exposeID('id', {
      authWith: ['readUserField'],
    }),
    firstName: t.exposeString('firstName', {
      authWith: ['readUserField'],
    }),
    lastName: t.exposeString('lastName', {
      authWith: ['readUserField'],
    }),
    email: t.exposeString('email', {
      authWith: ['readUserField'],
    }),
  }),
});
