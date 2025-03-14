import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { relations } from './db/relations';
import { Relations } from 'drizzle-orm';

export const client = createClient({ url: `file:${resolve(__dirname, './db/dev.db')}` });

export const db = drizzle(client, { relations });

db.query.users.findMany({
  where: {
    AND: [
      {
        id: {},
      },
    ],
  },
});

export { relations };

export type DrizzleRelations = typeof relations;
