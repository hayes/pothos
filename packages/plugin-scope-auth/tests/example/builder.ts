/* eslint-disable @typescript-eslint/require-await */
import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import RelayPlugin from '@pothos/plugin-relay';
import type PrismaTypes from '../../prisma/generated';
import ScopeAuthPlugin from '../../src';
import { db } from './db';
import User from './user';

interface Context {
  user: User | null;
  count?: (name: string) => void;
}

const builder = new SchemaBuilder<{
  Context: Context;
  Interfaces: {
    StringInterface: {};
  };
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    syncPermission: string;
    asyncPermission: string;
  };
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
  },
  scopeAuth: {
    authorizeOnSubscribe: true,
    defaultStrategy: 'all',
    authScopes: async (context) => {
      context.count?.('authScopes');

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

          return !!context.user?.permissions.includes(perm);
        },
      };
    },
  },
});

export default builder;
