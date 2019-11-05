import builder from '../builder';

export default builder.createObjectType('User', {
  shape: t => ({
    id: t.exposeID('id'),
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    email: t.exposeString('email'),
  }),
});
