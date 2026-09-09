/**
 * Public surface of the playground's prisma-next capture utilities.
 * User code imports this as `@pothos/playground-capture` (a synthetic
 * specifier registered in `prisma-next-bundle.ts`) so the demos look
 * like real third-party adoption of the prisma-next middleware SPI.
 */

export type { CapturedSql } from './capture';
export { capturePlaygroundSql } from './capture-middleware';
