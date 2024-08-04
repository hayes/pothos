import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './db/schema';

export { schema };

export const client = createClient({ url: `file:${resolve(__dirname, './db/dev.db')}` });

export const db = drizzle(client, { schema });

export type DrizzleSchema = typeof schema;
