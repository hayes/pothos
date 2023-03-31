import builder from '../builder';
import { customers } from '../data';

builder.interfaceType('User', {
  fields: (t) => ({
    id: t.id(),
    displayName: t.string(),
  }),
});

builder.node('Customer', {
  id: {
    resolve: (user) => user.id,
  },
  loadOne: (id) => customers[Number.parseInt(String(id), 10)],
  isTypeOf: () => true,
  // Objects that implement Node can also implement any additional
  // interface
  interfaces: () => ['User'],
  fields: (t) => ({
    age: t.exposeInt('age'),
  }),
});

builder.queryType({});

builder.queryField('nullConnection', (t) =>
  t.connection({
    type: 'Boolean',
    args: {
      ...t.arg.connectionArgs(),
    },
    resolve: (root, args) => ({
      edges: null,
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
    }),
  }),
);

export default builder.toSchema();
