import { SQL, type SQLChunk } from 'drizzle-orm';

// Since Drizzle 1.0.0-rc.5, relation helpers return chunks; older supported releases return SQL.
export function normalizeSQL(value: SQL | SQLChunk[]): SQL;
export function normalizeSQL(value: SQL | SQLChunk[] | undefined): SQL | undefined;
export function normalizeSQL(value: SQL | SQLChunk[] | undefined): SQL | undefined {
  return Array.isArray(value) ? new SQL(value) : value;
}
