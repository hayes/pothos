import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-relay';
import RelayPlugin from '@pothos/plugin-scope-auth';
import { getTableConfig } from 'drizzle-orm/pg-core';
import DrizzlePlugin from '../../src';
import { type DrizzleRelations, db, relations } from './db';
export default new SchemaBuilder<{
  DrizzleRelations: DrizzleRelations;
}>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: db,
    getTableConfig,
    relations,
  },
  scopeAuth: {
    authScopes: () => ({}),
  },
});
