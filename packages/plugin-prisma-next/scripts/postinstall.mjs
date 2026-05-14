#!/usr/bin/env node
/**
 * Post-install hook: build the sibling `prisma-next` clone so the
 * plugin's `link:` deps resolve to real `dist/` outputs.
 *
 * `prisma-next` has `dist/` in `.gitignore` and no `prepare` script on
 * its packages, so freshly cloning the sibling repo leaves
 * `main`/`exports` pointing at files that don't exist. We bridge by
 * running `pnpm install && pnpm -r build` in the sibling tree if any
 * of the key `dist/` artifacts are missing.
 *
 * Safe to no-op:
 *   - sibling clone missing  → print one-liner instruction, exit 0
 *   - artifacts already built → exit 0
 *   - env `POTHOS_SKIP_PRISMA_NEXT_BUILD=1` → exit 0
 *
 * The plugin is `private: true` until prisma-next publishes to npm; at
 * that point this hook + the `link:` deps both go away (see
 * `_publishGate` in package.json).
 */

import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pluginDir = dirname(fileURLToPath(import.meta.url));
const prismaNextDir = resolve(pluginDir, '../../../../prisma-next');

// Each package the plugin's `devDependencies` link: to. Their dist
// outputs are content-hashed by tsdown, so we sentinel on a
// non-empty `dist/` rather than a specific filename.
const linkedPackages = [
  'packages/3-targets/6-adapters/sqlite',
  'packages/1-framework/0-foundation/contract',
  'packages/3-targets/7-drivers/sqlite',
  'packages/1-framework/1-core/framework-components',
  'packages/2-sql/4-lanes/sql-builder',
  'packages/2-sql/1-core/contract',
  'packages/3-extensions/sql-orm-client',
  'packages/2-sql/4-lanes/relational-core',
  'packages/2-sql/5-runtime',
  'packages/3-extensions/sqlite',
  'packages/3-targets/3-targets/sqlite',
];

function isPackageBuilt(pkgRel) {
  const distDir = resolve(prismaNextDir, pkgRel, 'dist');
  if (!existsSync(distDir)) return false;
  try {
    return readdirSync(distDir).length > 0;
  } catch {
    return false;
  }
}

if (process.env.POTHOS_SKIP_PRISMA_NEXT_BUILD === '1') {
  console.log('[plugin-prisma-next] POTHOS_SKIP_PRISMA_NEXT_BUILD set — skipping.');
  process.exit(0);
}

if (!existsSync(prismaNextDir)) {
  console.log(
    `[plugin-prisma-next] sibling prisma-next clone not found at ${prismaNextDir}. ` +
      'Clone it next to pothos to enable plugin-prisma-next development. Skipping.',
  );
  process.exit(0);
}

const missing = linkedPackages.filter((p) => !isPackageBuilt(p));
if (missing.length === 0) {
  console.log('[plugin-prisma-next] prisma-next sibling already built — skipping.');
  process.exit(0);
}

console.log(
  `[plugin-prisma-next] building prisma-next sibling (${missing.length} package(s) missing dist)...`,
);

try {
  // Install first (in case the sibling clone has no node_modules), then
  // run the full workspace build. `--no-frozen-lockfile` keeps us
  // tolerant of in-flight upstream pnpm-lock drift.
  execSync('pnpm install --no-frozen-lockfile', {
    cwd: prismaNextDir,
    stdio: 'inherit',
  });
  execSync('pnpm -r --workspace-concurrency=1 build', {
    cwd: prismaNextDir,
    stdio: 'inherit',
  });
} catch (err) {
  console.error(
    '[plugin-prisma-next] sibling build failed. Re-run manually:\n' +
      `  cd ${prismaNextDir} && pnpm install && pnpm -r build\n` +
      'Or skip this hook with POTHOS_SKIP_PRISMA_NEXT_BUILD=1.',
  );
  throw err;
}

console.log('[plugin-prisma-next] prisma-next sibling built.');
