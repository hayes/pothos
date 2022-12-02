import builder from '../builder';
import { users } from '../data';

builder.node('User', {
  id: {
    resolve: (user) => user.id,
  },
  isTypeOf: () => true,
  fields: (t) => ({
    age: t.exposeInt('age'),
  }),
});

builder.queryType({
  fields: (t) => ({
    firstUser: t.field({
      type: 'User',
      resolve: () => users[0],
    }),
    allUsers: t.field({
      type: ['User'],
      resolve: () => users,
    }),
  }),
});

export default builder.toSchema();
