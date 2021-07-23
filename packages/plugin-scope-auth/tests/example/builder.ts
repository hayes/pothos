/* eslint-disable @typescript-eslint/require-await */
import SchemaBuilder from '@giraphql/core';
import ScopeAuthPlugin from '../../src';
import User from './user';

interface Context {
  User: User | null;
  count?: (name: string) => void;
}

const builder = new SchemaBuilder<{
  Context: Context;
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    syncPermission: string;
    asyncPermission: string;
  };
  AuthContexts: {
    loggedIn: Context & { User: User };
  };
}>({
  plugins: [ScopeAuthPlugin],
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
