import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './db/schema';

// eslint-disable-next-line unicorn/prefer-module
const client = createClient({ url: `file:${resolve(__dirname, './db/dev.db')}` });

export const db = drizzle(client, { schema });

export type DrizzleSchema = typeof schema;
