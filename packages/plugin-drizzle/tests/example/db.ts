import { resolve } from 'node:path';
import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './db/schema';

// eslint-disable-next-line unicorn/prefer-module
const client = createClient({ url: `file:${resolve(__dirname, './db/dev.db')}` });

export const db = drizzle(client, { schema });

export type DrizzleSchema = typeof schema;

void db.query.usersToGroups.findFirst({
  where: (usersToGroups) => inArray(usersToGroups.groupId, [1, 2]),
});
