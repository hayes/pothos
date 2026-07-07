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
  'plugin-dataloader',
  'plugin-complexity',
  'plugin-mocks',
  'plugin-sub-graph',
  'plugin-add-graphql',
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

/**
 * Bundle the `dataloader` npm package's own .d.ts.
 *
 * `@pothos/plugin-dataloader`'s type defs reference `DataLoader` via
 * `import ... from 'dataloader'`. Without a `declare module 'dataloader'`
 * in the Monaco/type-check world those imports resolve to `any` and the
 * plugin's loadable-field signatures (loaderOptions, the DataLoader
 * handle) collapse. We wrap dataloader's shipped `index.d.ts` — which
 * uses `export = DataLoader` with a merged namespace — in a module
 * declaration so it resolves by its bare specifier. This is types-only;
 * at runtime the `dataloader` code is bundled INTO the statically
 * imported plugin module (see lib/playground/plugins-bundle.ts), so it
 * never round-trips through esm.sh and there is a single @pothos/core
 * instance.
 */
function readDataloaderTypes(): TypeDefinition[] {
  const dataloaderDts = path.join(__dirname, '../node_modules/dataloader/index.d.ts');
  if (!fs.existsSync(dataloaderDts)) {
    console.warn(`No dataloader types found at ${dataloaderDts}; skipping.`);
    return [];
  }
  const raw = fs
    .readFileSync(dataloaderDts, 'utf-8')
    .replace(/^\/\/\/\s*<reference.*$/gm, '')
    .replace(/\/\/# sourceMappingURL=.*$/gm, '')
    .trim();

  return [
    {
      moduleName: 'dataloader',
      content: `declare module 'dataloader' {\n${raw}\n}`,
    },
  ];
}

function main() {
  const coreDefinitions: TypeDefinition[] = [];
  const pluginDefinitions: Record<string, TypeDefinition[]> = {};

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

  // plugin-dataloader's type defs import from the `dataloader` package.
  // Ship dataloader's own types alongside it so those imports resolve
  // (loaded on-demand only when the example imports plugin-dataloader).
  if (pluginDefinitions['@pothos/plugin-dataloader']) {
    pluginDefinitions['@pothos/plugin-dataloader'].push(...readDataloaderTypes());
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

export interface TypeDefinition {
  moduleName: string;
  content: string;
}

// Core Pothos types (always loaded)
export const coreTypeDefinitions: TypeDefinition[] = ${JSON.stringify(orderedCore, null, 2)};

// Plugin types (loaded on-demand)
export const pluginTypeDefinitions: Record<string, TypeDefinition[]> = ${JSON.stringify(pluginDefinitions, null, 2)};

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
}

main();
