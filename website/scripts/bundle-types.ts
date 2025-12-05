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

// Plugin types are not loaded by default because their global type augmentations
// add required fields even when the plugin isn't imported.
// TODO: Add plugin types conditionally based on what's imported in the example
const PLUGIN_PACKAGES: string[] = [
  // 'plugin-relay',
  // 'plugin-errors',
  // 'plugin-validation',
  // 'plugin-scope-auth',
  // 'plugin-simple-objects',
  // 'plugin-directives',
  // 'plugin-dataloader',
  // 'plugin-add-graphql',
];

function readDtsFiles(packagePath: string, moduleName: string): TypeDefinition[] {
  const dtsPath = path.join(packagePath, 'dts');
  if (!fs.existsSync(dtsPath)) {
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
  baseModule: string,
  isIndexFile: boolean
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
      if (resultParts.length > 2) { // Keep at least '@pothos/core'
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
  isIndexFile: boolean
): string {
  let processed = content
    .replace(/\/\/# sourceMappingURL=.*$/gm, '')
    .replace(/^\/\/\/\s*<reference.*$/gm, '');

  // Generic function to replace import/export paths
  function replaceRelativePath(match: string, prefix: string, relativePath: string, suffix: string): string {
    const resolved = resolveImportPath(relativePath, fullModuleName, baseModule, isIndexFile);
    return `${prefix}'${resolved}'${suffix}`;
  }

  // Handle all import patterns with proper path resolution
  processed = processed
    // import ... from '../..path' or from './path' or from '../path'
    .replace(
      /(from\s*)['"](\.[^'"]+)['"]/g,
      (match, prefix, relativePath) => replaceRelativePath(match, prefix, relativePath, '')
    )
    // import './path' (side-effect import)
    .replace(
      /(import\s*)['"](\.[^'"]+)['"]/g,
      (match, prefix, relativePath) => replaceRelativePath(match, prefix, relativePath, '')
    )
    // export ... from './path'
    .replace(
      /(export\s+\*\s+from\s*)['"](\.[^'"]+)['"]/g,
      (match, prefix, relativePath) => replaceRelativePath(match, prefix, relativePath, '')
    )
    .replace(
      /(export\s+\{[^}]+\}\s+from\s*)['"](\.[^'"]+)['"]/g,
      (match, prefix, relativePath) => replaceRelativePath(match, prefix, relativePath, '')
    );

  const hasGlobalDeclaration = processed.includes('declare global');

  if (hasGlobalDeclaration) {
    return processed.trim();
  }

  return `declare module '${fullModuleName}' {\n${processed.trim()}\n}`;
}

function generateGraphQLTypes(): string {
  return `
declare module 'graphql' {
  export interface GraphQLScalarType<TInternal = unknown, TExternal = TInternal> {
    name: string;
    description?: string | null;
    serialize: (value: unknown) => TExternal | null;
    parseValue?: (value: unknown) => TInternal | null;
    parseLiteral?: (ast: unknown, variables?: Record<string, unknown> | null) => TInternal | null;
  }

  export interface GraphQLSchema {
    getQueryType(): GraphQLObjectType | null | undefined;
    getMutationType(): GraphQLObjectType | null | undefined;
    getSubscriptionType(): GraphQLObjectType | null | undefined;
  }

  export interface GraphQLObjectType {
    name: string;
  }

  export interface GraphQLInputObjectType {
    name: string;
  }

  export interface GraphQLInterfaceType {
    name: string;
  }

  export interface GraphQLUnionType {
    name: string;
  }

  export interface GraphQLEnumType {
    name: string;
  }

  export type GraphQLType =
    | GraphQLScalarType
    | GraphQLObjectType
    | GraphQLInterfaceType
    | GraphQLUnionType
    | GraphQLEnumType
    | GraphQLInputObjectType
    | GraphQLList<GraphQLType>
    | GraphQLNonNull<GraphQLType>;

  export interface GraphQLList<T> {
    ofType: T;
  }

  export interface GraphQLNonNull<T> {
    ofType: T;
  }

  export interface GraphQLField<TSource, TContext, TArgs = Record<string, unknown>> {
    name: string;
    type: GraphQLOutputType;
    args: ReadonlyArray<GraphQLArgument>;
    resolve?: GraphQLFieldResolver<TSource, TContext, TArgs>;
  }

  export interface GraphQLArgument {
    name: string;
    type: GraphQLInputType;
    defaultValue?: unknown;
  }

  export type GraphQLOutputType =
    | GraphQLScalarType
    | GraphQLObjectType
    | GraphQLInterfaceType
    | GraphQLUnionType
    | GraphQLEnumType
    | GraphQLList<GraphQLOutputType>
    | GraphQLNonNull<GraphQLOutputType>;

  export type GraphQLInputType =
    | GraphQLScalarType
    | GraphQLInputObjectType
    | GraphQLEnumType
    | GraphQLList<GraphQLInputType>
    | GraphQLNonNull<GraphQLInputType>;

  export type GraphQLFieldResolver<TSource, TContext, TArgs = Record<string, unknown>> = (
    source: TSource,
    args: TArgs,
    context: TContext,
    info: GraphQLResolveInfo,
  ) => unknown;

  export interface GraphQLResolveInfo {
    fieldName: string;
    returnType: GraphQLOutputType;
    parentType: GraphQLObjectType;
    schema: GraphQLSchema;
  }

  export function printSchema(schema: GraphQLSchema): string;
}
`.trim();
}

function main() {
  const allDefinitions: TypeDefinition[] = [];

  allDefinitions.push({
    moduleName: 'graphql',
    content: generateGraphQLTypes(),
  });

  for (const pkg of CORE_PACKAGES) {
    const packagePath = path.join(PACKAGES_DIR, pkg);
    const moduleName = `@pothos/${pkg}`;
    const definitions = readDtsFiles(packagePath, moduleName);
    allDefinitions.push(...definitions);
  }

  for (const pkg of PLUGIN_PACKAGES) {
    const packagePath = path.join(PACKAGES_DIR, pkg);
    if (fs.existsSync(packagePath)) {
      const moduleName = `@pothos/${pkg}`;
      const definitions = readDtsFiles(packagePath, moduleName);
      allDefinitions.push(...definitions);
    }
  }

  // Separate global declarations from module declarations
  // Global declarations need special handling - they should be loaded first
  const globalDeclarations = allDefinitions.filter((d) => d.content.includes('declare global'));
  const moduleDeclarations = allDefinitions.filter((d) => !d.content.includes('declare global'));

  // Reorder: globals first, then modules
  const orderedDefinitions = [...globalDeclarations, ...moduleDeclarations];

  const output = `// Auto-generated Pothos type definitions for Monaco editor
// Generated at: ${new Date().toISOString()}

export interface TypeDefinition {
  moduleName: string;
  content: string;
}

export const pothosTypeDefinitions: TypeDefinition[] = ${JSON.stringify(orderedDefinitions, null, 2)};

export function getTypeDefinitions(): TypeDefinition[] {
  return pothosTypeDefinitions;
}
`;

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, output);

  console.log(`Generated ${orderedDefinitions.length} type definitions to ${OUTPUT_FILE}`);
  console.log(`  - ${globalDeclarations.length} global declarations`);
  console.log(`  - ${moduleDeclarations.length} module declarations`);
}

main();
