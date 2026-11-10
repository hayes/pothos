// The builder of `union-key.ts`, without its fields.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin from '../../src';
import { relations } from './relations';

export declare const db: LibSQLDatabase<typeof relations>;

export const builder = new SchemaBuilder<{ DrizzleRelations: typeof relations }>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: db, getTableConfig, relations },
});
