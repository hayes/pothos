import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema';

// eslint-disable-next-line unicorn/prefer-module
const sqlite = new Database(resolve(__dirname, './db/dev.db'));
export const db = drizzle(sqlite, { schema });

export type DrizzleSchema = typeof schema;
