//#region src/core/sql-utils.d.ts
/**
 * Shared SQL utility functions for the SQLite target.
 *
 * These functions handle safe SQL identifier and literal escaping. They
 * live in `target-sqlite` (mirroring `target-postgres/src/core/sql-utils.ts`)
 * so both the control adapter (used at emit time) and the runtime adapter
 * (used at execute time) can depend on them through a single one-way edge:
 * `adapter-sqlite → target-sqlite`. Hosting them target-side avoids the
 * cyclic workspace dependency that would arise if `target-sqlite` reached
 * back into `adapter-sqlite` for these primitives.
 */
declare class SqlEscapeError extends Error {
  readonly value: string;
  readonly kind: 'identifier' | 'literal';
  constructor(message: string, value: string, kind: 'identifier' | 'literal');
}
declare function quoteIdentifier(identifier: string): string;
declare function escapeLiteral(value: string): string;
//#endregion
export { SqlEscapeError, escapeLiteral, quoteIdentifier };
//# sourceMappingURL=sql-utils.d.mts.map