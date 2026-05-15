// Single source of truth for the prisma-next client across the demo.
// Every step's `db.ts` is identical so the schema changes — not the
// runtime wiring — drive what the SQL panel shows.

import { capturePlaygroundSql } from '@pothos/playground-capture';
import { registerSeed } from '@prisma-next/driver-sqlite/seed';
import sqlite from '@prisma-next/sqlite/runtime';
import type { Contract } from './contract';
import contractJson from './contract.json';
import seedSql from './seed.sql';

// `seed:<key>` is the playground sql.js driver's bootstrap convention.
// In production this is a regular sqlite path (`./app.db`).
registerSeed('blog', seedSql);

export const db = sqlite<Contract>({
  contractJson,
  path: 'seed:blog',
  // The capture middleware is a regular prisma-next `SqlMiddleware` —
  // the same SPI you'd use to add lints, budgets, or telemetry. Here
  // it pushes each executed plan's SQL + pre-lowering AST into the
  // playground's `extensions.playgroundPanels`, so the SQL / Prisma
  // query AST tabs to the right of the response stay in sync with
  // what actually ran against the database.
  middleware: [capturePlaygroundSql],
});

export type { Contract };
