import { inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

export const queryClient = postgres('postgresql://prisma:prisma@localhost:5455/drizzle');

export const db = drizzle(queryClient, { schema });

export type DrizzleSchema = typeof schema;

void db.query.usersToGroups.findFirst({
  where: (usersToGroups) => inArray(usersToGroups.groupId, [1, 2]),
});
