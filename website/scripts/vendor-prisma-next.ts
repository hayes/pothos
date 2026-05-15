#!/usr/bin/env tsx
/**
 * Vendor a snapshot of @prisma-next/* packages from the sibling
 * `prisma-next` clone into `website/vendor/prisma-next/`. The
 * playground demo imports these by their npm names (resolved via Next
 * + tsconfig path aliases, see `next.config.mjs` and `tsconfig.json`).
 *
 * Usage:
 *   pnpm --filter @pothos/website tsx scripts/vendor-prisma-next.ts
 *
 * Refresh policy: this is a deliberate copy, not a build-time dep. Run
 * this script when the sibling clone advances and you want to update
 * the snapshot. The vendored output is committed.
 */
import { execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const websiteDir = resolve(__dirname, '..');
const vendorDir = join(websiteDir, 'vendor', 'prisma-next');
const prismaNextRoot = resolve(websiteDir, '../../prisma-next');

// Seed: packages plugin-prisma-next consumes + the user-facing factory.
// driver-sqlite is intentionally excluded — we ship our own sql.js
// driver at lib/playground/prisma-next/sql-js-driver.ts.
const SEED = [
  '@prisma-next/sqlite',
  '@prisma-next/sql-orm-client',
  '@prisma-next/sql-contract',
  '@prisma-next/contract',
  '@prisma-next/adapter-sqlite',
  '@prisma-next/target-sqlite',
];

// SKIP_VENDOR: don't copy these into vendor/. Either browser-incompatible
// (CLI tools, migration runner) or hand-written (driver-sqlite has a
// sql.js-backed shim that lives in this dir).
const SKIP_VENDOR = new Set<string>([
  '@prisma-next/driver-sqlite',
  '@prisma-next/cli',
  '@prisma-next/migration-tools',
  '@prisma-next/psl-parser',
  '@prisma-next/psl-printer',
  '@prisma-next/emitter',
  '@prisma-next/sql-contract-emitter',
  '@prisma-next/config',
]);

// STRIP_DEP: also strip from emitted package.json `dependencies`. The
// build-time packages aren't in the workspace, so referencing them
// would break pnpm install. driver-sqlite IS in the workspace (the
// hand-written shim), so it stays declared.
const STRIP_DEP = new Set<string>([
  '@prisma-next/cli',
  '@prisma-next/migration-tools',
  '@prisma-next/psl-parser',
  '@prisma-next/psl-printer',
  '@prisma-next/emitter',
  '@prisma-next/sql-contract-emitter',
  '@prisma-next/config',
]);

if (!existsSync(prismaNextRoot)) {
  console.error(`prisma-next sibling clone not found at ${prismaNextRoot}`);
  process.exit(1);
}

const catalog = readCatalog(prismaNextRoot);
const pkgPathByName = listPrismaNextPackages(prismaNextRoot);

const toVisit = [...SEED];
const visited = new Set<string>();
while (toVisit.length > 0) {
  const name = toVisit.shift()!;
  if (visited.has(name) || SKIP_VENDOR.has(name)) {
    continue;
  }
  visited.add(name);
  const src = pkgPathByName.get(name);
  if (!src) {
    console.warn(`skip: ${name} not found in sibling clone`);
    continue;
  }
  const pkg = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (dep.startsWith('@prisma-next/') && !SKIP_VENDOR.has(dep)) {
      toVisit.push(dep);
    }
  }
}

console.log(`Vendoring ${visited.size} packages from ${prismaNextRoot}`);

// Wipe the dirs we're about to repopulate, plus any stale dirs from
// previous runs that no longer match the vendor set. Preserve hand-written
// packages (driver-sqlite — sql.js shim) and the manifest.
const PRESERVE_SLUGS = new Set(['driver-sqlite']);
mkdirSync(vendorDir, { recursive: true });
for (const ent of readdirSync(vendorDir, { withFileTypes: true })) {
  if (!ent.isDirectory()) {
    continue;
  }
  if (PRESERVE_SLUGS.has(ent.name)) {
    continue;
  }
  rmSync(join(vendorDir, ent.name), { recursive: true, force: true });
}

const manifest: Array<{ name: string; from: string }> = [];
for (const name of [...visited].sort()) {
  const src = pkgPathByName.get(name)!;
  const distSrc = join(src, 'dist');
  if (!existsSync(distSrc)) {
    console.error(
      `missing dist/ for ${name} at ${distSrc}. Run \`pnpm -r build\` in the sibling clone.`,
    );
    process.exit(1);
  }
  const slug = name.replace('@prisma-next/', '');
  const dest = join(vendorDir, slug);
  mkdirSync(dest, { recursive: true });
  cpSync(distSrc, join(dest, 'dist'), { recursive: true });

  const pkg = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
  const slim: Record<string, unknown> = {
    name: pkg.name,
    version: pkg.version,
    type: pkg.type,
    sideEffects: false,
  };
  for (const k of ['main', 'module', 'types', 'exports']) {
    if (pkg[k] !== undefined) {
      slim[k] = pkg[k];
    }
  }
  // Keep only @prisma-next/* + a small allow-list of npm deps the
  // runtime actually uses. Anything excluded (and the entries it
  // transitively pulls in) needs to be unreachable from the
  // playground's import paths, or esbuild will fail to bundle.
  const runtimeDepAllowlist = new Set(['arktype', 'uniku']);
  const deps: Record<string, string> = {};
  for (const [name, spec] of Object.entries((pkg.dependencies ?? {}) as Record<string, string>)) {
    if (STRIP_DEP.has(name)) {
      continue;
    }
    if (name.startsWith('@prisma-next/')) {
      deps[name] = 'workspace:*';
    } else if (runtimeDepAllowlist.has(name)) {
      deps[name] = spec === 'catalog:' ? (catalog.get(name) ?? spec) : spec;
    }
  }
  if (Object.keys(deps).length > 0) {
    slim.dependencies = deps;
  }
  writeFileSync(join(dest, 'package.json'), `${JSON.stringify(slim, null, 2)}\n`);
  manifest.push({ name, from: pkg.repository?.directory ?? src });
}

const headSha = (() => {
  try {
    return execSync('git rev-parse HEAD', { cwd: prismaNextRoot }).toString().trim();
  } catch {
    return 'unknown';
  }
})();

writeFileSync(
  join(vendorDir, 'manifest.json'),
  `${JSON.stringify({ sourceSha: headSha, vendoredAt: new Date().toISOString(), packages: manifest }, null, 2)}\n`,
);

console.log(`Vendored ${manifest.length} packages → ${vendorDir}`);
console.log(`source SHA: ${headSha}`);

function readCatalog(root: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const yaml = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');
    let inCatalog = false;
    for (const raw of yaml.split('\n')) {
      if (/^catalog:\s*$/.test(raw)) {
        inCatalog = true;
        continue;
      }
      if (inCatalog) {
        if (/^\S/.test(raw)) {
          inCatalog = false;
          continue;
        }
        const m = /^\s+['"]?([^'":]+)['"]?:\s*['"]?([^'"\s]+)['"]?\s*$/.exec(raw);
        if (m) {
          out.set(m[1].trim(), m[2].trim());
        }
      }
    }
  } catch {
    // no catalog → no substitutions
  }
  return out;
}

function listPrismaNextPackages(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const stack = [join(root, 'packages')];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) {
        continue;
      }
      if (ent.name === 'node_modules' || ent.name === 'dist') {
        continue;
      }
      const full = join(dir, ent.name);
      const pkgPath = join(full, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
          if (typeof pkg.name === 'string' && pkg.name.startsWith('@prisma-next/')) {
            out.set(pkg.name, full);
            continue;
          }
        } catch {
          // not a parseable package.json, descend
        }
      }
      stack.push(full);
    }
  }
  return out;
}
