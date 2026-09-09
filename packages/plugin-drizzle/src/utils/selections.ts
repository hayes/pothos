import type { DBQueryConfig } from 'drizzle-orm';

export type SelectionMap = DBQueryConfig<'one'>;

/** Drops keys holding `undefined`, so `{ where: cond ? filter : undefined }` reads as `{}`. */
export function omitUndefinedKeys<T extends object>(query: T): T {
  const entries = Object.entries(query);
  const defined = entries.filter(([, value]) => value !== undefined);

  return defined.length === entries.length ? query : (Object.fromEntries(defined) as T);
}
