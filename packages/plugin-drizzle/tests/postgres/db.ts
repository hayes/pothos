import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './db/schema';

export const queryClient = postgres('postgresql://prisma:prisma@localhost:5455/drizzle');

export const db = drizzle(queryClient, { schema });

export type DrizzleSchema = typeof schema;
