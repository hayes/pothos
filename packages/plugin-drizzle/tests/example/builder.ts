import SchemaBuilder from '@pothos/core';
import AddGraphQL from '@pothos/plugin-add-graphql';
import ErrorsPlugin from '@pothos/plugin-errors';
import ScopeAuthPlugin from '@pothos/plugin-relay';
import RelayPlugin from '@pothos/plugin-scope-auth';
import WithInputPlugin from '@pothos/plugin-with-input';
import { drizzle } from 'drizzle-orm/libsql';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin from '../../src';
import type { AuthContexts, BaseContext } from './context';
import { type DrizzleRelations, client, db, relations } from './db';

export interface PothosTypes {
  DrizzleRelations: DrizzleRelations;
  Context: BaseContext;
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    role: string;
  };
  AuthContexts: AuthContexts;
  Scalars: {
    DateTime: { Input: Date; Output: Date | string };
  };
}

export const builder = new SchemaBuilder<PothosTypes>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin, AddGraphQL, WithInputPlugin, ErrorsPlugin],
  drizzle: {
    client: (_ctx) => db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: (ctx) => ({
      loggedIn: !!ctx.user,
      admin: !!ctx.roles.includes('admin'),
      role: (role: string) => ctx.roles.includes(role),
    }),
  },
});
