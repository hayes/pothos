import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { relations } from '../db/relations.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const client = createClient({
  url: `file:${resolve(__dirname, '../db/dev.db')}`,
});

export const db = drizzle({ client, relations });

export { relations };
export type DrizzleRelations = typeof relations;
