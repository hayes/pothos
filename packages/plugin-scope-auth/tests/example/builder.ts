/* eslint-disable @typescript-eslint/require-await */
import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '../../src';
import User from './user';

interface Context {
  user: User | null;
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
    loggedIn: !!context.user,
    admin: !!context.user?.roles.includes('admin'),
    syncPermission: (perm) => {
      context.count?.('syncPermission');

      return !!context.user?.permissions.includes(perm);
    },
    asyncPermission: async (perm) => {
      context.count?.('asyncPermission');

      return !!context.user?.permissions.includes(perm);
    },
  }),
});

export default builder;
