import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import RelayPlugin from '@pothos/plugin-relay';
import type PrismaTypes from '../../prisma/generated';
import { getDatamodel } from '../../prisma/generated';
import ScopeAuthPlugin from '../../src';
import { db } from './db';
import type User from './user';

interface Context {
  user: User | null;
  count?: (name: string) => void;
}

interface AuthScopes {
  loggedIn: boolean;
  admin: boolean;
  syncPermission: string;
  asyncPermission: string;
  boundPermission: boolean;
}

const builder = new SchemaBuilder<{
  Context: Context;
  Interfaces: {
    StringInterface: {};
  };
  AuthScopes: AuthScopes;
  AuthContexts: {
    loggedIn: Context & { user: User; isLoggedIn: true };
    admin: Context & { user: User; isAdmin: true };
  };
  PrismaTypes: PrismaTypes;
  DefaultAuthStrategy: 'all';
}>({
  plugins: [ScopeAuthPlugin, PrismaPlugin, RelayPlugin],
  relay: {
    clientMutationId: 'omit',
    cursorType: 'String',
  },
  prisma: {
    client: db,
    dmmf: getDatamodel(),
  },
  scopeAuth: {
    authorizeOnSubscribe: true,
    defaultStrategy: 'all',
    authScopes: async (context) => {
      await context.count?.('authScopes');

      // locally reference use to simulate data loaded in this authScopes fn that depends on incoming
      // context data and is not modifiable from resolvers
      const { user } = context;
      return {
        loggedIn: !!user,
        admin: !!user?.roles.includes('admin'),
        syncPermission: (perm) => {
          context.count?.('syncPermission');

          return !!context.user?.permissions.includes(perm);
        },
        asyncPermission: async (perm) => {
          context.count?.('asyncPermission');

          return await !!context.user?.permissions.includes(perm);
        },
        boundPermission(this: AuthScopes) {
          return this.admin;
        },
      };
    },
  },
});

export default builder;
