import SchemaBuilder from '@giraphql/core';
import '../../src';
import User from './user';

const builder = new SchemaBuilder<{
  Context: {
    User: User | null;
  };
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    deferredAdmin: boolean;
    hasPermission: string;
  };
}>({
  plugins: ['GiraphQLScopeAuth'],
  authScopes: async (context) => ({
    loggedIn: !!context.User,
    admin: !!context.User?.roles.includes('admin'),
    deferredAdmin: async () => {
      const result = await context.User?.roles.includes('admin');

      return !!result;
    },
    hasPermission: (perm) => !!context.User?.permissions.includes(perm),
  }),
});

export default builder;
