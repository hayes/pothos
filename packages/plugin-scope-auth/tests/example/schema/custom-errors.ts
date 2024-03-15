/* eslint-disable @typescript-eslint/require-await */
import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '../../../src';
import { db } from '../db';
import User from '../user';

interface Context {
  user: User | null;
  count?: (name: string) => void;
}

const builder = new SchemaBuilder<{
  Defaults: 'v3';
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
  defaults: 'v3',
  relayOptions: {},
  defaultFieldNullability: true,
  scopeAuthOptions: {
    unauthorizedError: (parent, context, info, result) =>
      new Error(`${result.failure.kind}: ${result.message}`),
    runScopesOnType: true,
  },
  prisma: {
    client: db,
  },
  plugins: [ScopeAuthPlugin],
  authScopes: (context) => ({
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

const User2 = builder.objectRef<User>('User2').implement({
  runScopesOnType: false,
  authScopes: {
    admin: true,
  },
  fields: (t) => ({ id: t.exposeID('id', { nullable: true }) }),
});

builder.queryType({
  fields: (t) => ({
    me: t.field({
      type: User,
      resolve: (parent, args, context) => context.user,
    }),
    me2: t.field({ type: User2, resolve: (parent, args, context) => context.user }),
    test: t.string({ authScopes: () => false, resolve: () => 'test' }),
  }),
});

export default builder.toSchema();
