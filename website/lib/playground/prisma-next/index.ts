/**
 * Public surface of the playground's prisma-next capture utilities.
 * User code imports this as `@pothos/playground-capture` (the bundler's
 * synthetic alias) so the demos look like real third-party adoption of
 * the prisma-next middleware SPI.
 */

export {
  type CapturedSql,
  getCapturedPanels,
  getCaptures,
  resetCapture,
} from './capture';
export { capturePlaygroundSql } from './capture-middleware';
