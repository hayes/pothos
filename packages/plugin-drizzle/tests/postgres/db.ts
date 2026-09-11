import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { relations } from './db/relations';
export const queryClient = postgres(
  process.env.POTHOS_DRIZZLE_TEST_DATABASE_URL ??
    'postgresql://prisma:prisma@localhost:5455/drizzle',
);

export const db = drizzle({ client: queryClient, relations });

export type DrizzleRelations = typeof relations;
export { relations };
