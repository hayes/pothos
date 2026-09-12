import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import RelayPlugin from '@pothos/plugin-relay';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { db } from './database';
import { relations } from './tables';

// #region builder
export const builder = new SchemaBuilder<{
  DrizzleRelations: typeof relations;
  Context: { userId: number };
}>({
  relay: { nodesOnConnection: true },
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: db, relations, getTableConfig },
});
// #endregion builder
