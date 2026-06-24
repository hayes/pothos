/**
 * Script to bundle Pothos type definitions for Monaco editor
 * Run with: npx tsx scripts/bundle-types.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const PACKAGES_DIR = path.join(__dirname, '../../packages');
const OUTPUT_FILE = path.join(__dirname, '../lib/playground/pothos-types.ts');

interface TypeDefinition {
  moduleName: string;
  content: string;
}

const CORE_PACKAGES = ['core'];

// Plugin packages to bundle separately
// Plugin types are loaded dynamically based on imports to avoid
// adding required fields from unused plugins
const PLUGIN_PACKAGES: string[] = [
  'plugin-simple-objects',
  'plugin-relay',
  'plugin-with-input',
  'plugin-scope-auth',
  'plugin-errors',
  'plugin-validation',
  'plugin-directives',
  'plugin-prisma-next',
];

function readDtsFiles(packagePath: string, moduleName: string): TypeDefinition[] {
  const dtsPath = path.join(packagePath, 'dts');
  if (!fs.existsSync(dtsPath)) {
    // Core packages are required — failing silently here ships Monaco
    // with no Pothos types and surfaces as confusing red squiggles in
    // the playground. For optional plugin packages we still warn-and-
    // skip below.
    if (CORE_PACKAGES.includes(moduleName.replace(/^@pothos\//, ''))) {
      throw new Error(
        `Missing dts directory for ${moduleName} at ${dtsPath}.\n` +
          "Run 'pnpm turbo run build' first to build packages/*/dts.",
      );
    }
    console.warn(`No dts directory found for ${moduleName}`);
    return [];
  }

  const definitions: TypeDefinition[] = [];

  function walkDir(dir: string, baseModule: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walkDir(fullPath, `${baseModule}/${entry.name}`);
      } else if (entry.name.endsWith('.d.ts') && !entry.name.endsWith('.d.ts.map')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const relativePath = path.relative(dtsPath, fullPath);
        const isIndexFile = entry.name === 'index.d.ts';
        const moduleSubPath = relativePath.replace(/\.d\.ts$/, '').replace(/\/index$/, '');
        const fullModuleName =
          moduleSubPath === 'index' ? moduleName : `${moduleName}/${moduleSubPath}`;

        definitions.push({
          moduleName: fullModuleName,
          content: processTypeContent(content, fullModuleName, moduleName, isIndexFile),
        });
      }
    }
  }

  walkDir(dtsPath, moduleName);

  if (definitions.length === 0 && CORE_PACKAGES.includes(moduleName.replace(/^@pothos\//, ''))) {
    throw new Error(
      `No .d.ts files found under ${dtsPath} for ${moduleName}.\n` +
        "Run 'pnpm turbo run build' first to build packages/*/dts.",
    );
  }

  return definitions;
}

/**
 * Resolve a relative import path to an absolute module path.
 *
 * @param relativePath - The relative import path (e.g., '../builder', './types')
 * @param currentModule - The full module name of the current file (e.g., '@pothos/core/types/global/classes')
 * @param baseModule - The base module name (e.g., '@pothos/core')
 * @param isIndexFile - Whether the current module represents an index file (affects directory calculation)
 */
function resolveImportPath(
  relativePath: string,
  currentModule: string,
  _baseModule: string,
  isIndexFile: boolean,
): string {
  // Remove .js extension if present
  const cleanPath = relativePath.replace(/\.js$/, '');

  // Get the directory of the current module
  // For index files like '@pothos/core/types/global', the directory IS '@pothos/core/types/global'
  // For non-index files like '@pothos/core/types/global/classes', the directory is '@pothos/core/types/global'
  let currentDir: string;

  if (isIndexFile) {
    // This is an index file, so the module name is the directory
    currentDir = currentModule;
  } else {
    // Get the directory part (everything except the last segment)
    const parts = currentModule.split('/');
    currentDir = parts.slice(0, -1).join('/');
  }

  // Split into path segments
  const currentParts = currentDir.split('/');
  const importParts = cleanPath.split('/');

  // Process each segment
  const resultParts = [...currentParts];

  for (const part of importParts) {
    if (part === '.') {
      // Current directory, do nothing
    } else if (part === '..') {
      // Go up one level
      if (resultParts.length > 2) {
        // Keep at least '@pothos/core'
        resultParts.pop();
      }
    } else {
      // Add the path segment
      resultParts.push(part);
    }
  }

  return resultParts.join('/');
}

function processTypeContent(
  content: string,
  fullModuleName: string,
  baseModule: string,
  isIndexFile: boolean,
): string {
  let processed = content
    .replace(/\/\/# sourceMappingURL=.*$/gm, '')
    .replace(/^\/\/\/\s*<reference.*$/gm, '');

  // Generic function to replace import/export paths
  function replaceRelativePath(
    _match: string,
    prefix: string,
    relativePath: string,
    suffix: string,
  ): string {
    const resolved = resolveImportPath(relativePath, fullModuleName, baseModule, isIndexFile);
    return `${prefix}'${resolved}'${suffix}`;
  }

  // Handle all import patterns with proper path resolution
  processed = processed
    // import ... from '../..path' or from './path' or from '../path'
    .replace(/(from\s*)['"](\.[^'"]+)['"]/g, (match, prefix, relativePath) =>
      replaceRelativePath(match, prefix, relativePath, ''),
    )
    // import './path' (side-effect import)
    .replace(/(import\s*)['"](\.[^'"]+)['"]/g, (match, prefix, relativePath) =>
      replaceRelativePath(match, prefix, relativePath, ''),
    )
    // import('./path') — dynamic import used in *type* positions, e.g.
    // `ExposableShape = import('./types').Row<Types, M>`. Without this
    // rewrite the relative specifier survives into a `declare module`
    // block where TS silently resolves it to `any`, collapsing every
    // downstream generic that depends on it (and producing
    // permissive-string overloads for things like `exposeID`).
    .replace(/(import\(\s*)['"](\.[^'"]+)['"](\s*\))/g, (match, prefix, relativePath, suffix) =>
      replaceRelativePath(match, prefix, relativePath, suffix),
    )
    // export ... from './path'
    .replace(/(export\s+\*\s+from\s*)['"](\.[^'"]+)['"]/g, (match, prefix, relativePath) =>
      replaceRelativePath(match, prefix, relativePath, ''),
    )
    .replace(/(export\s+\{[^}]+\}\s+from\s*)['"](\.[^'"]+)['"]/g, (match, prefix, relativePath) =>
      replaceRelativePath(match, prefix, relativePath, ''),
    );

  const hasGlobalDeclaration = processed.includes('declare global');

  if (hasGlobalDeclaration) {
    return processed.trim();
  }

  return `declare module '${fullModuleName}' {\n${processed.trim()}\n}`;
}

/**
 * Read and bundle the full GraphQL type definitions from node_modules
 *
 * Instead of creating a custom stub, we bundle the real GraphQL .d.ts files.
 * We aggregate all the type definitions into a single 'graphql' module to avoid
 * needing to resolve internal GraphQL imports.
 *
 * The bundle walks a fixed set of subdirectories recursively so that new
 * .d.ts files added in a graphql version bump get picked up automatically.
 */
function readGraphQLTypes(): TypeDefinition[] {
  const graphqlPath = path.join(__dirname, '../../node_modules/graphql');
  if (!fs.existsSync(graphqlPath)) {
    throw new Error(`Missing graphql package at ${graphqlPath}.\nRun 'pnpm install' first.`);
  }
  // jsutils first because the other directories reference its types.
  const SUBDIRS = ['jsutils', 'language', 'type', 'utilities', 'execution', 'error'];
  const allContent: string[] = [];

  function readAndStrip(filePath: string): string {
    let content = fs.readFileSync(filePath, 'utf-8');
    // Remove internal GraphQL imports since we're bundling everything together
    // Keep only the exported declarations
    content = content
      .replace(/^import\s+(?:type\s+)?{[^}]+}\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^export\s+(?:type\s+)?{[^}]+}\s+from\s+['"][^'"]+['"];?\s*$/gm, '');
    return content;
  }

  function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }
    const out: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // Sort so order is deterministic across runs / filesystems.
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...walk(full));
      } else if (entry.name.endsWith('.d.ts') && !entry.name.endsWith('.d.ts.map')) {
        // Skip index.d.ts files inside subdirs — they re-export from their
        // siblings, which we already include directly. Keeping them in
        // the bundle just adds redeclaration noise.
        if (entry.name === 'index.d.ts') {
          continue;
        }
        out.push(full);
      }
    }
    return out;
  }

  let collectedFiles = 0;
  for (const sub of SUBDIRS) {
    const files = walk(path.join(graphqlPath, sub));
    for (const file of files) {
      allContent.push(readAndStrip(file));
      collectedFiles++;
    }
  }

  if (collectedFiles === 0) {
    throw new Error(
      `No .d.ts files found under ${graphqlPath}/{${SUBDIRS.join(',')}}.\n` +
        'The graphql package may be installed without type definitions.',
    );
  }

  // Combine everything into a single graphql module declaration
  const combinedContent = allContent.join('\n\n');

  return [
    {
      moduleName: 'graphql',
      content: `declare module 'graphql' {\n${combinedContent}\n}`,
    },
  ];
}

interface RawTypeFile {
  filePath: string;
  content: string;
}

/**
 * Strip `.mjs` extensions from relative imports inside a .d.ts file
 * so TS's classic resolver can pick up the renamed (.d.ts) target.
 * Only touches `./` / `../` specifiers; bare imports flow through
 * unchanged (those resolve via paths or node_modules).
 */
function rewriteRelativeImports(content: string): string {
  return content
    .replace(/(from\s+['"])(\.[^'"]+)\.mjs(['"])/g, '$1$2$3')
    .replace(/(import\s+['"])(\.[^'"]+)\.mjs(['"])/g, '$1$2$3');
}

interface PrismaNextTypes {
  files: RawTypeFile[];
  /**
   * Explicit `paths` map for each `@prisma-next/<pkg>/<subpath>` →
   * `.d.mts` location. Monaco's TS in 0.52.x doesn't reliably honour
   * `package.json#exports`, so generating paths here means resolution
   * works regardless of moduleResolution kind.
   */
  paths: Record<string, string[]>;
}

// The `@prisma-next/driver-sqlite` npm build targets Node's
// `node:sqlite` and ships no `/seed` export, so at runtime the
// playground swaps in the hand-written sql.js shim (aliased in
// `next.config.mjs`). Feed Monaco the SHIM's `.d.mts` declarations for
// driver-sqlite so the editor sees the same surface the runtime uses
// (including `/seed`). This slug is read from `lib/playground/...`
// rather than `node_modules`.
const DRIVER_SQLITE_SHIM_DIR = path.join(__dirname, '../lib/playground/prisma-next/driver-sqlite');

// Build-tooling / CLI packages that are node-only and never imported
// by playground user code or the contract type chain. Skipped so the
// Monaco bundle doesn't carry psl-parser / emitter / migration-tools
// type trees (and the deps they pull in). Mirrors the old
// `vendor-prisma-next.ts` SKIP set.
const PRISMA_NEXT_TYPE_SKIP = new Set<string>([
  '@prisma-next/cli',
  '@prisma-next/cli-telemetry',
  '@prisma-next/config',
  '@prisma-next/emitter',
  '@prisma-next/migration-tools',
  '@prisma-next/psl-parser',
  '@prisma-next/psl-printer',
  '@prisma-next/sql-contract-emitter',
  '@prisma-next/sql-contract-psl',
  '@prisma-next/sql-contract-ts',
  '@prisma-next/contract-authoring',
]);

/**
 * Resolve the on-disk directory for an installed `@prisma-next/<pkg>`
 * package. Prefers the website's own `node_modules/@prisma-next/<pkg>`
 * symlink, falls back to the monorepo root, then to the pnpm content-
 * addressed store (where transitive deps live without a top-level link).
 * Returns null if not installed.
 */
function resolvePrismaNextPackageDir(pkgName: string): string | null {
  for (const base of [
    path.join(__dirname, '../node_modules', pkgName),
    path.join(__dirname, '../../node_modules', pkgName),
  ]) {
    if (fs.existsSync(path.join(base, 'package.json'))) {
      return fs.realpathSync(base);
    }
  }
  const slug = pkgName.replace('@prisma-next/', '');
  const storeRoot = path.join(__dirname, '../../node_modules/.pnpm');
  if (fs.existsSync(storeRoot)) {
    for (const entry of fs.readdirSync(storeRoot)) {
      if (!entry.startsWith(`@prisma-next+${slug}@`)) {
        continue;
      }
      const candidate = path.join(storeRoot, entry, 'node_modules', pkgName);
      if (fs.existsSync(path.join(candidate, 'package.json'))) {
        return fs.realpathSync(candidate);
      }
    }
  }
  return null;
}

/**
 * List every installed `@prisma-next/*` package, scanning the website's
 * own `node_modules/@prisma-next`, the monorepo root, AND the pnpm store
 * (so transitive type-only deps like `utils`, `target-sqlite`, `ids`
 * that aren't direct deps still get their `.d.mts` bundled — the
 * contract/codec type chain reaches through them). Build-tooling
 * packages in `PRISMA_NEXT_TYPE_SKIP` are excluded.
 */
function listInstalledPrismaNextPackages(): string[] {
  const names = new Set<string>();
  for (const base of [
    path.join(__dirname, '../node_modules/@prisma-next'),
    path.join(__dirname, '../../node_modules/@prisma-next'),
  ]) {
    if (!fs.existsSync(base)) {
      continue;
    }
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        names.add(`@prisma-next/${entry.name}`);
      }
    }
  }
  const storeRoot = path.join(__dirname, '../../node_modules/.pnpm');
  if (fs.existsSync(storeRoot)) {
    for (const entry of fs.readdirSync(storeRoot)) {
      const m = /^@prisma-next\+([a-z0-9-]+)@/.exec(entry);
      if (m) {
        names.add(`@prisma-next/${m[1]}`);
      }
    }
  }
  return [...names].filter((n) => !PRISMA_NEXT_TYPE_SKIP.has(n)).sort();
}

/**
 * Read the @prisma-next/* type declarations from the installed npm
 * packages (0.14.0). For each package's `exports`, emit:
 *  - every `.d.mts` file under `dist/`, renamed to `.d.ts`
 *  - the package.json (for exports-aware resolvers)
 *  - a `paths` entry mapping each subpath specifier to its `.d.ts`
 *
 * The `.mjs` runtime is bundled by Next/Turbopack; this only feeds
 * Monaco the type-side, which it can't see otherwise.
 *
 * `@prisma-next/driver-sqlite` is special-cased: its types come from
 * the sql.js shim under `lib/playground/...`, not the npm package,
 * because that shim is what the runtime actually executes.
 */
function readPrismaNextTypes(): PrismaNextTypes {
  const files: RawTypeFile[] = [];
  const paths: Record<string, string[]> = {};

  const emitDtsTree = (rootDir: string, pkgName: string, relBase: string) => {
    const walk = (dir: string, rel: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relPath = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(fullPath, relPath);
          continue;
        }
        if (!entry.name.endsWith('.d.mts') || entry.name.endsWith('.d.mts.map')) {
          continue;
        }
        const renamed = relPath.replace(/\.d\.mts$/, '.d.ts');
        files.push({
          filePath: `file:///node_modules/${pkgName}/${relBase}/${renamed}`,
          content: rewriteRelativeImports(fs.readFileSync(fullPath, 'utf8')),
        });
      }
    };
    walk(rootDir, '');
  };

  for (const pkgName of listInstalledPrismaNextPackages()) {
    // driver-sqlite types come from the shim — handled below.
    if (pkgName === '@prisma-next/driver-sqlite') {
      continue;
    }
    const pkgDir = resolvePrismaNextPackageDir(pkgName);
    if (!pkgDir) {
      continue;
    }
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      continue;
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    files.push({
      filePath: `file:///node_modules/${pkgName}/package.json`,
      content: fs.readFileSync(pkgJsonPath, 'utf8'),
    });

    // Emit each .d.mts file as .d.ts at the same dist layout and strip
    // `.mjs` extensions from relative imports inside. Monaco's TS
    // classic resolver doesn't try `.d.mts` extensions for a relative
    // import like `./codecs-XYZ.mjs`, so files renamed to `.d.ts` with
    // extension-less imports resolve through the same virtual filesystem
    // on every TS resolution mode. Recurses into dist subdirectories —
    // without that, paths entries point at files not in extraLibs and
    // generic types silently resolve to `any`.
    const distDir = path.join(pkgDir, 'dist');
    if (fs.existsSync(distDir)) {
      emitDtsTree(distDir, pkgName, 'dist');
    }

    // Generate paths entries from the package's exports field.
    // `exports['./X']: './dist/X.mjs'` → paths[`@pkg/X`] → dist/X.d.ts.
    const exportsField = pkgJson.exports as Record<string, unknown> | undefined;
    if (exportsField) {
      for (const [exportKey, target] of Object.entries(exportsField)) {
        if (exportKey === './package.json') {
          continue;
        }
        // Exports can be a string or a conditions object ({ types, import }).
        let mjsTarget: string | undefined;
        if (typeof target === 'string') {
          mjsTarget = target;
        } else if (target && typeof target === 'object') {
          const cond = target as Record<string, unknown>;
          const pick = cond.types ?? cond.import ?? cond.default;
          if (typeof pick === 'string') {
            mjsTarget = pick;
          }
        }
        if (!mjsTarget) {
          continue;
        }
        const dts = mjsTarget
          .replace(/\.d\.mts$/, '.d.ts')
          .replace(/\.mjs$/, '.d.ts')
          .replace(/^\.\//, '');
        const subpath = exportKey.replace(/^\.\//, '');
        const specifier = exportKey === '.' ? pkgName : `${pkgName}/${subpath}`;
        paths[specifier] = [`file:///node_modules/${pkgName}/${dts}`];
      }
    }
  }

  // driver-sqlite: hand-written sql.js shim. Ships `.mjs` (runtime) +
  // `.d.mts` (types) flat in its directory, no `dist/`. Apply the same
  // `.d.mts` → `.d.ts` rename + import-extension scrub, and synthesize
  // package.json + exports-shaped paths so Monaco resolves
  // `@prisma-next/driver-sqlite/runtime` and `/seed` to the shim.
  if (fs.existsSync(DRIVER_SQLITE_SHIM_DIR)) {
    const pkgName = '@prisma-next/driver-sqlite';
    const shimPkgJson = {
      name: pkgName,
      version: '0.14.0',
      type: 'module',
      sideEffects: false,
      exports: {
        './runtime': './runtime.mjs',
        './seed': './seed.mjs',
        './package.json': './package.json',
      },
    };
    files.push({
      filePath: `file:///node_modules/${pkgName}/package.json`,
      content: `${JSON.stringify(shimPkgJson, null, 2)}\n`,
    });
    for (const file of fs.readdirSync(DRIVER_SQLITE_SHIM_DIR)) {
      if (!file.endsWith('.d.mts') && !file.endsWith('.d.ts')) {
        continue;
      }
      const renamed = file.replace(/\.d\.mts$/, '.d.ts');
      files.push({
        filePath: `file:///node_modules/${pkgName}/${renamed}`,
        content: rewriteRelativeImports(
          fs.readFileSync(path.join(DRIVER_SQLITE_SHIM_DIR, file), 'utf8'),
        ),
      });
    }
    paths[`${pkgName}/runtime`] = [`file:///node_modules/${pkgName}/runtime.d.ts`];
    paths[`${pkgName}/seed`] = [`file:///node_modules/${pkgName}/seed.d.ts`];
  }

  return { files, paths };
}

function main() {
  const coreDefinitions: TypeDefinition[] = [];
  const pluginDefinitions: Record<string, TypeDefinition[]> = {};
  const { files: prismaNextLibs, paths: prismaNextPaths } = readPrismaNextTypes();

  // Add GraphQL types to core (bundled from node_modules)
  const graphqlTypes = readGraphQLTypes();
  coreDefinitions.push(...graphqlTypes);
  // zod and any other arbitrary npm package the user imports get their
  // types via Auto-Type Acquisition (`setup-monaco-ata.ts`) at runtime
  // — fetched from jsdelivr on demand. Nothing else to bundle here.

  // Process core packages
  for (const pkg of CORE_PACKAGES) {
    const packagePath = path.join(PACKAGES_DIR, pkg);
    const moduleName = `@pothos/${pkg}`;
    const definitions = readDtsFiles(packagePath, moduleName);
    coreDefinitions.push(...definitions);
  }

  // Process plugin packages separately
  for (const pkg of PLUGIN_PACKAGES) {
    const packagePath = path.join(PACKAGES_DIR, pkg);
    if (fs.existsSync(packagePath)) {
      const moduleName = `@pothos/${pkg}`;
      const definitions = readDtsFiles(packagePath, moduleName);
      pluginDefinitions[moduleName] = definitions;
    }
  }

  // Separate core global declarations from module declarations
  const coreGlobals = coreDefinitions.filter((d) => d.content.includes('declare global'));
  const coreModules = coreDefinitions.filter((d) => !d.content.includes('declare global'));
  const orderedCore = [...coreGlobals, ...coreModules];

  const output = `// Auto-generated Pothos type definitions for Monaco editor
// Generated at: ${new Date().toISOString()}
//
// Core types are loaded immediately
// Plugin types are loaded dynamically based on imports
// Prisma-next types are vendored .d.mts files, loaded on-demand when
// any @prisma-next/* import is detected — registered at file paths
// that mirror real node_modules so TS resolves subpaths via the
// vendored package.json's exports field, not a declare-module wrapper.

export interface TypeDefinition {
  moduleName: string;
  content: string;
}

export interface RawTypeFile {
  filePath: string;
  content: string;
}

// Core Pothos types (always loaded)
export const coreTypeDefinitions: TypeDefinition[] = ${JSON.stringify(orderedCore, null, 2)};

// Plugin types (loaded on-demand)
export const pluginTypeDefinitions: Record<string, TypeDefinition[]> = ${JSON.stringify(pluginDefinitions, null, 2)};

// Vendored @prisma-next/* type files (loaded on-demand on first
// @prisma-next/* import). Each entry's filePath is a node_modules-shaped
// URI that TS's module resolution can walk.
export const prismaNextTypeFiles: RawTypeFile[] = ${JSON.stringify(prismaNextLibs, null, 2)};

// Explicit \`paths\` entries the playground feeds to Monaco's TS
// compiler options when @prisma-next/* imports are detected. Generated
// from each vendored package's exports field so Monaco resolves
// subpaths even when its TS version doesn't honour package.json
// exports natively.
export const prismaNextPaths: Record<string, string[]> = ${JSON.stringify(prismaNextPaths, null, 2)};

export function getCoreTypeDefinitions(): TypeDefinition[] {
  return coreTypeDefinitions;
}

export function getPluginTypeDefinitions(pluginName: string): TypeDefinition[] {
  return pluginTypeDefinitions[pluginName] || [];
}

export function getAllPluginNames(): string[] {
  return Object.keys(pluginTypeDefinitions);
}
`;

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output);

  const totalPluginDefs = Object.values(pluginDefinitions).reduce(
    (sum, defs) => sum + defs.length,
    0,
  );
  console.log(`Generated type definitions to ${OUTPUT_FILE}`);
  console.log(`  - ${orderedCore.length} core definitions`);
  console.log(`  - ${totalPluginDefs} plugin definitions across ${PLUGIN_PACKAGES.length} plugins`);
  for (const [plugin, defs] of Object.entries(pluginDefinitions)) {
    console.log(`    - ${plugin}: ${defs.length} definitions`);
  }
  console.log(`  - ${prismaNextLibs.length} @prisma-next/* type files`);
}

main();
