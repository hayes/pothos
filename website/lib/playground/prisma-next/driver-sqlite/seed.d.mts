/**
 * Type declarations for the hand-written sql.js seed registry. The
 * runtime is in `seed.mjs`; this file gives TS something to resolve
 * for `import { registerSeed } from '@prisma-next/driver-sqlite/seed'`.
 */
export declare function registerSeed(key: string, sql: string): void;
export declare function takeSeed(key: string): string | undefined;
export declare function clearSeed(key: string): void;
