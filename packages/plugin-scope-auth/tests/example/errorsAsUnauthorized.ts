/* eslint-disable @typescript-eslint/require-await */
import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin, { AuthFailure, AuthScopeFailureType } from '../../src';
import { db } from './db';
import User from './user';

interface Context {
  user: User | null;
  count?: (name: string) => void;
  throwInScope?: boolean;
  throwFirst?: boolean;
}

function throwFirstError(failure: AuthFailure, recursive: boolean) {
  if ('error' in failure && failure.error) {
    throw failure.error;
  }

  if (
    recursive &&
    (failure.kind === AuthScopeFailureType.AnyAuthScopes ||
      failure.kind === AuthScopeFailureType.AllAuthScopes)
  ) {
    for (const child of failure.failures) {
      throwFirstError(child, recursive);
    }
  }
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
  DefaultFieldNullability: true;
}>({
  relay: {},
  scopeAuth: {
    treatErrorsAsUnauthorized: true,
    unauthorizedError: (parent, context, info, result) => {
      if (context.throwFirst) {
        throwFirstError(result.failure, context.throwFirst);
      }

      return result.message;
    },
    authScopes: (context) => ({
      loggedIn: !!context.user,
      admin: !!context.user?.roles.includes('admin'),
      syncPermission: (perm) => {
        context.count?.('syncPermission');

        if (context.throwInScope) {
          throw new Error('syncPermission');
        }

        return !!context.user?.permissions.includes(perm);
      },
      asyncPermission: async (perm) => {
        context.count?.('asyncPermission');

        await Promise.resolve();

        if (context.throwInScope) {
          throw new Error('asyncPermission');
        }

        return !!context.user?.permissions.includes(perm);
      },
    }),
  },
  prisma: {
    client: db,
  },
  plugins: [ScopeAuthPlugin],
});

builder.objectType(User, {
  name: 'User',
  authScopes: {
    admin: true,
  },
  fields: (t) => ({
    id: t.string({
      nullable: true,
      resolve: (user) => user.id,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    syncPermission: t.boolean({
      authScopes: {
        syncPermission: 'syncPermission',
      },
      resolve: () => true,
    }),
    asyncPermission: t.boolean({
      authScopes: {
        asyncPermission: 'asyncPermission',
      },
      resolve: () => true,
    }),
    any: t.boolean({
      authScopes: {
        $any: {
          syncPermission: 'syncPermission',
          asyncPermission: 'asyncPermission',
        },
      },
      resolve: () => true,
    }),
    all: t.boolean({
      authScopes: {
        $all: {
          syncPermission: 'syncPermission',
          asyncPermission: 'asyncPermission',
        },
      },
      resolve: () => true,
    }),
    inlineSync: t.boolean({
      authScopes: () => {
        throw new Error('inlineSync');
      },
      resolve: () => true,
    }),
    inlineAsync: t.boolean({
      authScopes: async () => {
        throw new Error('inlineAsync');
      },
      resolve: () => true,
    }),
  }),
});

export default builder.toSchema();
