/* eslint-disable @typescript-eslint/require-await */
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
    syncPermission: string;
    asyncPermission: string;
  };
}>({
  plugins: ['GiraphQLScopeAuth'],
  authScopes: async (context) => ({
    loggedIn: !!context.User,
    admin: !!context.User?.roles.includes('admin'),
    syncPermission: (perm) => !!context.User?.permissions.includes(perm),
    asyncPermission: (perm) => !!context.User?.permissions.includes(perm),
  }),
});

export default builder;
