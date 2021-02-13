/* eslint-disable @typescript-eslint/require-await */
import '../../src';
import SchemaBuilder from '@giraphql/core';
import User from './user';

const builder = new SchemaBuilder<{
  Context: {
    User: User | null;
    count?: (name: string) => void;
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
    syncPermission: (perm) => {
      context.count?.('syncPermission');

      return !!context.User?.permissions.includes(perm);
    },
    asyncPermission: async (perm) => {
      context.count?.('asyncPermission');

      return !!context.User?.permissions.includes(perm);
    },
  }),
});

export default builder;
