import SchemaBuilder from '@pothos/core';
import AddGraphQL from '@pothos/plugin-add-graphql';
import ErrorsPlugin from '@pothos/plugin-errors';
import ScopeAuthPlugin from '@pothos/plugin-relay';
import RelayPlugin from '@pothos/plugin-scope-auth';
import WithInputPlugin from '@pothos/plugin-with-input';
import { drizzle } from 'drizzle-orm/libsql';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin from '../../src';
import { type DrizzleRelations, client, relations } from './db';

export interface BaseContext {
  user?: {
    id: number;
  };
  roles: string[];
}
export interface PothosTypes {
  DrizzleRelations: DrizzleRelations;
  Context: BaseContext;
  AuthScopes: {
    loggedIn: boolean;
    admin: boolean;
    role: string;
  };
  AuthContexts: {
    loggedIn: BaseContext & { user: {} };
    role: BaseContext & { user: {} };
  };
  Scalars: {
    DateTime: { Input: Date; Output: Date | string };
  };
}

export const builder = new SchemaBuilder<PothosTypes>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin, AddGraphQL, WithInputPlugin, ErrorsPlugin],
  drizzle: {
    client: (_ctx) => drizzle(client, { relations }),
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
