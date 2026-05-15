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

/**
 * Walk the vendored @prisma-next/* dist directories. For each
 * package's `exports`, emit:
 *  - the `.d.mts` file at its node_modules path
 *  - any internal chunk files in the same dist directory
 *  - the package.json (for future exports-aware resolvers)
 *  - a `paths` entry mapping the subpath specifier to the .d.mts
 *
 * The `.mjs` files are already served by the workspace at runtime;
 * this only feeds Monaco the type-side, which it can't see otherwise.
 */
function readPrismaNextTypes(): PrismaNextTypes {
  const vendorRoot = path.join(__dirname, '../vendor/prisma-next');
  if (!fs.existsSync(vendorRoot)) {
    return { files: [], paths: {} };
  }
  const files: RawTypeFile[] = [];
  const paths: Record<string, string[]> = {};
  for (const pkgSlug of fs.readdirSync(vendorRoot)) {
    const pkgDir = path.join(vendorRoot, pkgSlug);
    if (!fs.statSync(pkgDir).isDirectory()) {
      continue;
    }
    const pkgJsonPath = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      continue;
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const pkgName: string = pkgJson.name;
    if (typeof pkgName !== 'string' || !pkgName.startsWith('@prisma-next/')) {
      continue;
    }

    files.push({
      filePath: `file:///node_modules/${pkgName}/package.json`,
      content: fs.readFileSync(pkgJsonPath, 'utf8'),
    });

    // Emit each .d.mts file as .d.ts at the same path layout and strip
    // `.mjs` extensions from relative imports inside. Monaco's TS
    // classic resolver doesn't try `.d.mts` extensions when resolving
    // a relative import like `./codecs-XYZ.mjs`, so files renamed to
    // `.d.ts` with extension-less imports resolve through the same
    // virtual filesystem on every TS resolution mode. Recurses into
    // dist subdirectories (e.g. `dist/exports/`) — without that, paths
    // entries point at files that aren't in extraLibs, so generic
    // types like `CodecDefBuilder` silently resolve to `any`.
    const distDir = path.join(pkgDir, 'dist');
    if (fs.existsSync(distDir)) {
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
            filePath: `file:///node_modules/${pkgName}/dist/${renamed}`,
            content: rewriteRelativeImports(fs.readFileSync(fullPath, 'utf8')),
          });
        }
      };
      walk(distDir, '');
    }

    // Generate paths entries from the package's exports field.
    // `exports['./X']: './dist/X.mjs'` → paths[`@pkg/X`] → dist/X.d.ts.
    const exportsField = pkgJson.exports as Record<string, unknown> | undefined;
    if (exportsField) {
      for (const [exportKey, target] of Object.entries(exportsField)) {
        if (exportKey === './package.json') {
          continue;
        }
        if (typeof target !== 'string') {
          continue;
        }
        const dts = target.replace(/\.mjs$/, '.d.ts').replace(/^\.\//, '');
        const subpath = exportKey.replace(/^\.\//, '');
        const specifier = exportKey === '.' ? pkgName : `${pkgName}/${subpath}`;
        paths[specifier] = [`file:///node_modules/${pkgName}/${dts}`];
      }
    }

    // driver-sqlite is hand-written and ships .mjs (runtime) +
    // .d.mts (types) in src/, no pre-built dist. Apply the same
    // .d.mts → .d.ts rename + import-extension scrub to its src/.
    const srcDir = path.join(pkgDir, 'src');
    if (fs.existsSync(srcDir)) {
      for (const file of fs.readdirSync(srcDir)) {
        if (!file.endsWith('.d.mts') && !file.endsWith('.d.ts')) {
          continue;
        }
        const renamed = file.replace(/\.d\.mts$/, '.d.ts');
        files.push({
          filePath: `file:///node_modules/${pkgName}/src/${renamed}`,
          content: rewriteRelativeImports(fs.readFileSync(path.join(srcDir, file), 'utf8')),
        });
      }
    }
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
