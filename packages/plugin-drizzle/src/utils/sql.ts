import { SQL, type SQLChunk } from 'drizzle-orm';

// Drizzle RC5 returns chunks from its relation helpers; earlier releases return SQL objects.
export function normalizeSQL(value: SQL | SQLChunk[]): SQL;
export function normalizeSQL(value: SQL | SQLChunk[] | undefined): SQL | undefined;
export function normalizeSQL(value: SQL | SQLChunk[] | undefined): SQL | undefined {
  return Array.isArray(value) ? new SQL(value) : value;
}
