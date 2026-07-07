/**
 * Script to type-check playground examples using TypeScript compiler API
 * Run with: npx tsx scripts/test-playground-examples.ts
 */

import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { type GraphQLSchema, parse, validate } from 'graphql';
import * as ts from 'typescript';
import { getCoreTypeDefinitions, getPluginTypeDefinitions } from '../lib/playground/pothos-types';

// Load examples from individual directories.
//
// Three layouts are supported, mirroring `scripts/build-playground-examples.ts`:
//
// - Flat: `<example>/schema.ts` + `<example>/query.graphql`. Single
//   testable unit, ID is `metadata.id`.
// - Stepped: `<example>/step-N/schema.ts` (+ optional query.graphql),
//   one testable unit per step. IDs are `${metadata.id}-step-${N}` so
//   failures point to the exact file path on disk.
// - Variant: `<example>/schema.ts` (the default variant) plus
//   `<example>/variant-<slug>/schema.ts` for each alternative style.
//   IDs are `${metadata.id}` (default) and `${metadata.id}-variant-<slug>`.
async function loadExamples() {
  const examplesDir = path.join(__dirname, '../playground-examples');
  const entries = await readdir(examplesDir, { withFileTypes: true });
  const exampleDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const examples = [];
  for (const dirName of exampleDirs) {
    const examplePath = path.join(examplesDir, dirName);

    // Read metadata
    const metadataPath = path.join(examplePath, 'metadata.json');
    const metadataContent = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    // Step-shaped example: each `step-N` subdir is its own testable unit.
    const subEntries = await readdir(examplePath, { withFileTypes: true });
    const stepDirs = subEntries
      .filter((e) => e.isDirectory() && e.name.startsWith('step-'))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (stepDirs.length > 0) {
      for (const stepDir of stepDirs) {
        const stepPath = path.join(examplePath, stepDir.name);
        const stepNumber = stepDir.name.replace('step-', '');
        const stepMeta = metadata.steps?.find((s: { id: string }) => s.id === stepDir.name);
        examples.push(
          await loadExampleFiles(stepPath, {
            id: `${metadata.id}-step-${stepNumber}`,
            title: stepMeta?.title || `${metadata.title} - Step ${stepNumber}`,
            description: stepMeta?.description || metadata.description,
            tags: metadata.tags || [],
          }),
        );
      }
      continue;
    }

    // Variant-shaped example: the top-level dir is the default variant,
    // and each `variant-<slug>` subdir is its own testable unit.
    const variantDirs = subEntries
      .filter((e) => e.isDirectory() && e.name.startsWith('variant-'))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (variantDirs.length > 0) {
      // Default variant lives at the example root.
      examples.push(
        await loadExampleFiles(examplePath, {
          id: metadata.id,
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags || [],
        }),
      );
      for (const variantDir of variantDirs) {
        const variantPath = path.join(examplePath, variantDir.name);
        const slug = variantDir.name.replace('variant-', '');
        const variantMeta = metadata.variants?.find((v: { id: string }) => v.id === slug);
        examples.push(
          await loadExampleFiles(variantPath, {
            id: `${metadata.id}-variant-${slug}`,
            title: variantMeta?.title
              ? `${metadata.title} — ${variantMeta.title}`
              : `${metadata.title} - ${slug}`,
            description: metadata.description,
            tags: metadata.tags || [],
          }),
        );
      }
      continue;
    }

    // Flat example.
    examples.push(
      await loadExampleFiles(examplePath, {
        id: metadata.id,
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags || [],
      }),
    );
  }

  return examples.sort((a, b) => a.id.localeCompare(b.id));
}

interface ExampleHeader {
  id: string;
  title: string;
  description?: string;
  tags: string[];
}

async function loadExampleFiles(dirPath: string, header: ExampleHeader) {
  const schemaPath = path.join(dirPath, 'schema.ts');
  const schemaContent = await readFile(schemaPath, 'utf-8');

  // Multi-file step bundles ship sibling source files (`builder.ts`,
  // `user.ts`, `db.ts`, contract `.d.ts` / `.json`, seed `.sql`). The
  // typechecker has to see them all or the imports in schema.ts
  // resolve to nothing. Pick up every code/data file in the dir,
  // EXCLUDING schema.ts (added separately as the entry point) and
  // .graphql query files (handled below).
  const entries = await readdir(dirPath, { withFileTypes: true });
  const siblingFiles: Array<{ filename: string; content: string; language?: 'typescript' }> = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const filename = entry.name;
    if (filename === 'schema.ts') {
      continue;
    }
    if (filename === 'metadata.json' || filename === 'README.md' || filename === 'schema.prisma') {
      continue;
    }
    if (filename.endsWith('.ts') || filename.endsWith('.json') || filename.endsWith('.sql')) {
      const content = await readFile(path.join(dirPath, filename), 'utf-8');
      siblingFiles.push({
        filename,
        content,
        ...(filename.endsWith('.ts') ? { language: 'typescript' as const } : {}),
      });
    }
  }

  let queryContent = '';
  try {
    const queryPath = path.join(dirPath, 'query.graphql');
    queryContent = await readFile(queryPath, 'utf-8');
  } catch {
    // Query file is optional
  }

  return {
    ...header,
    files: [
      {
        filename: 'schema.ts',
        content: schemaContent,
        language: 'typescript' as const,
      },
      ...siblingFiles,
    ],
    defaultQuery: queryContent || '{\n  # Add your query here\n}',
  };
}

interface TypeCheckResult {
  success: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
  }>;
}

/**
 * Create a TypeScript program from type definitions and test code.
 *
 * `siblingFiles` carries the other files in the example bundle
 * (user.ts, builder.ts, db.ts, contract.json, seed.sql, …). They're
 * registered under their original names so the entry `schema.ts`'s
 * relative imports (`./user`, `./db`, …) resolve.
 */
function typeCheckCode(
  code: string,
  pluginNames: string[],
  siblingFiles: Array<{ filename: string; content: string }> = [],
): TypeCheckResult {
  const errors: TypeCheckResult['errors'] = [];

  // Get all type definitions
  const coreTypes = getCoreTypeDefinitions();
  const pluginTypes = pluginNames.flatMap((name) => getPluginTypeDefinitions(name));
  const allTypes = [...coreTypes, ...pluginTypes];

  // Create a map of file paths to content
  const fileMap = new Map<string, string>();

  // Sibling files first — registered under `schema.ts`-relative paths
  // so `./user` etc. resolve. Data files (`.json`, `.sql`) get a
  // per-file `.d.ts` ambient sidecar so the bundler resolver can
  // match them by their exact specifier.
  for (const file of siblingFiles) {
    if (file.filename.endsWith('.json')) {
      fileMap.set(
        `${file.filename}.d.ts`,
        'declare const _default: unknown;\nexport default _default;\n',
      );
      continue;
    }
    if (file.filename.endsWith('.sql')) {
      fileMap.set(
        `${file.filename}.d.ts`,
        'declare const _default: string;\nexport default _default;\n',
      );
      continue;
    }
    if (file.filename.endsWith('.d.ts') || file.filename.endsWith('.ts')) {
      fileMap.set(file.filename, file.content);
    }
  }

  // Add the test code
  fileMap.set('test.ts', code);

  // Add all type definitions
  for (const typeDef of allTypes) {
    // Skip if content is missing
    if (!typeDef.content) {
      console.warn(`Warning: Missing content for ${typeDef.moduleName}`);
      continue;
    }

    const moduleParts = typeDef.moduleName.split('/');
    const hasGlobalDeclaration = typeDef.content.includes('declare global');

    // Determine file path
    let filePath: string;
    const isPackageRoot =
      typeDef.moduleName === 'graphql' ||
      (moduleParts.length === 2 && moduleParts[0] === '@pothos');

    if (hasGlobalDeclaration) {
      // Global declarations don't need node_modules path
      filePath = `${typeDef.moduleName.replace(/[@/]/g, '_')}.d.ts`;
    } else if (isPackageRoot) {
      filePath = `node_modules/${typeDef.moduleName}/index.d.ts`;
    } else {
      filePath = `node_modules/${typeDef.moduleName}.d.ts`;
    }

    fileMap.set(filePath, typeDef.content);
  }

  // Add zod types if code imports it
  if (code.includes("from 'zod'")) {
    try {
      const zodTypesPath = path.join(__dirname, '../node_modules/zod/index.d.ts');
      const zodTypes = readFileSync(zodTypesPath, 'utf-8');
      fileMap.set('node_modules/zod/index.d.ts', zodTypes);
    } catch (error) {
      console.warn('Warning: Could not load zod types:', error);
    }
  }

  // Create compiler options
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: false, // Enable lib checking
    noEmit: true,
    types: [],
    baseUrl: '.',
    paths: {},
  };

  // Create a custom compiler host with default lib files
  const host = ts.createCompilerHost(compilerOptions);

  // Store the original implementations before we override them
  const originalGetSourceFile = host.getSourceFile;
  const originalFileExists = host.fileExists;
  const originalReadFile = host.readFile;

  // Override file reading
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    // Normalize the file path
    const normalizedPath = fileName.replace(/\\/g, '/');

    // Check our file map first
    if (fileMap.has(normalizedPath)) {
      const content = fileMap.get(normalizedPath)!;
      return ts.createSourceFile(normalizedPath, content, languageVersion);
    }

    // Try to find it in the file map with different path variations
    for (const [mapPath, content] of Array.from(fileMap.entries())) {
      if (mapPath.endsWith(normalizedPath) || normalizedPath.endsWith(mapPath)) {
        return ts.createSourceFile(normalizedPath, content, languageVersion);
      }
    }

    // For all other files (including lib files), use the original implementation
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };

  host.fileExists = (fileName) => {
    const normalizedPath = fileName.replace(/\\/g, '/');
    if (fileMap.has(normalizedPath)) {
      return true;
    }

    // Check if any file map entry matches
    for (const mapPath of Array.from(fileMap.keys())) {
      if (mapPath.endsWith(normalizedPath) || normalizedPath.endsWith(mapPath)) {
        return true;
      }
    }

    // For all other files, use the original implementation
    return originalFileExists(fileName);
  };

  host.readFile = (fileName) => {
    const normalizedPath = fileName.replace(/\\/g, '/');
    const content = fileMap.get(normalizedPath);
    if (content !== undefined) {
      return content;
    }

    // For all other files, use the original implementation
    return originalReadFile(fileName);
  };

  // POSIX-style path join with `..` resolution for the fileMap keys.
  const posixJoin = (...parts: string[]): string => {
    const segments: string[] = [];
    for (const part of parts.join('/').split('/')) {
      if (part === '' || part === '.') {
        continue;
      }
      if (part === '..') {
        segments.pop();
        continue;
      }
      segments.push(part);
    }
    return segments.join('/');
  };

  // Add module resolution support
  host.resolveModuleNames = (moduleNames, _containingFile) => {
    return moduleNames.map((moduleName) => {
      // Relative imports — `./builder`, `./user.ts`, `./contract.json`,
      // and (inside vendored type packs' .d.mts files) chunked sibling
      // imports like `../codec-types-DJEaWT36`. Resolve against the
      // containing file's directory so the import path lines up with
      // how the bundle registered the chunk.
      if (moduleName.startsWith('./') || moduleName.startsWith('../')) {
        const containing = (_containingFile ?? '').replace(/\\/g, '/');
        // The containing file's path comes through absolute. Normalise
        // to the fileMap's key space: keys are either bare names
        // (`builder.ts` — example-local siblings) or `node_modules/...`
        // (vendored type-pack chunks). Pick the right base to join
        // against based on which case we're in.
        let containingDir = '';
        const nodeModulesIdx = containing.indexOf('/node_modules/');
        if (nodeModulesIdx !== -1) {
          const rel = containing.slice(nodeModulesIdx + 1); // strip leading `/`
          containingDir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
        }
        // Otherwise containingDir stays '' — local example files all
        // sit at the fileMap root.
        const joined = posixJoin(containingDir, moduleName);
        const candidates = [
          joined,
          `${joined}.ts`,
          `${joined}.d.ts`,
          `${joined}/index.ts`,
          `${joined}/index.d.ts`,
        ];
        for (const candidate of candidates) {
          if (fileMap.has(candidate)) {
            return { resolvedFileName: candidate, isExternalLibraryImport: false };
          }
        }
      }

      // Try to resolve as a node_modules path
      const possiblePaths = [
        `node_modules/${moduleName}/index.d.ts`,
        `node_modules/${moduleName}.d.ts`,
        `${moduleName.replace(/[@/]/g, '_')}.d.ts`,
      ];

      for (const tryPath of possiblePaths) {
        if (fileMap.has(tryPath)) {
          return {
            resolvedFileName: tryPath,
            isExternalLibraryImport: true,
          };
        }
      }

      return undefined;
    });
  };

  // Create the program. Pass sibling source files as entry points too
  // so the typechecker visits them, otherwise their own type errors
  // (and any cross-file inferences they contribute) silently disappear.
  const entryFiles = ['test.ts'];
  for (const filename of fileMap.keys()) {
    if (filename === 'test.ts') {
      continue;
    }
    if (filename.endsWith('.ts') && !filename.endsWith('.d.ts')) {
      entryFiles.push(filename);
    }
  }
  const program = ts.createProgram(entryFiles, compilerOptions, host);

  // Get diagnostics
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // User-authored example files (anything we explicitly added to the
  // bundle). Errors inside these — not just `test.ts` — are surfaced
  // so a typo in `user.ts` doesn't get swallowed.
  const exampleFiles = new Set(entryFiles);

  // Process diagnostics
  for (const diagnostic of diagnostics) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);

        if (exampleFiles.has(diagnostic.file.fileName)) {
          errors.push({
            file: diagnostic.file.fileName,
            line: line + 1,
            column: character + 1,
            message,
          });
        }
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Extract plugin imports from code
 */
function extractPluginImports(code: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+.*?\s+from\s+['"](@pothos\/plugin-[^'"]+)['"]/g;

  let match = importRegex.exec(code);
  while (match !== null) {
    imports.push(match[1]);
    match = importRegex.exec(code);
  }

  return imports;
}

/**
 * Test GraphQL query validation against a schema
 */
function testQuery(
  code: string,
  query: string,
  pluginImports: string[],
): { success: boolean; errors: string[] } {
  try {
    const errors: string[] = [];

    // Basic syntax checks
    if (!query.trim()) {
      errors.push('Query is empty');
      return { success: false, errors };
    }

    // Parse the query to check GraphQL syntax
    let documentAST: ReturnType<typeof parse>;
    try {
      documentAST = parse(query);
    } catch (error) {
      errors.push(`GraphQL parse error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors };
    }

    // Build the schema from the code
    let schema: GraphQLSchema;
    try {
      schema = buildSchemaFromCode(code, pluginImports);
    } catch (error) {
      errors.push(`Schema build error: ${error instanceof Error ? error.message : String(error)}`);
      return { success: false, errors };
    }

    // Validate the query against the schema
    const validationErrors = validate(schema, documentAST);
    if (validationErrors.length > 0) {
      for (const error of validationErrors) {
        errors.push(error.message);
      }
    }

    return { success: errors.length === 0, errors };
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
}

/**
 * Build a GraphQL schema from TypeScript code
 */
function buildSchemaFromCode(code: string, pluginImports: string[]): GraphQLSchema {
  // First, compile TypeScript to JavaScript
  const compileResult = ts.transpileModule(code, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });

  const jsCode = compileResult.outputText;

  // Create a map of module name to content
  const moduleMap: Record<string, unknown> = {};

  // Add required modules
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  moduleMap['@pothos/core'] = require('@pothos/core');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  moduleMap.graphql = require('graphql');

  // Load plugins
  for (const pluginName of pluginImports) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      moduleMap[pluginName] = require(pluginName);
    } catch {
      // Plugin might not be available, skip
    }
  }

  // Add zod if code imports it
  if (code.includes("from 'zod'")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      moduleMap.zod = require('zod');
    } catch {
      // zod not available
    }
  }

  // Create a custom require function
  const customRequire = (moduleName: string) => {
    if (moduleMap[moduleName]) {
      return moduleMap[moduleName];
    }
    throw new Error(`Module not found: ${moduleName}`);
  };

  // Create module and exports objects
  const moduleObj = { exports: {} };
  const exportsObj = moduleObj.exports;

  // Execute the compiled code
  // eslint-disable-next-line no-new-func
  const fn = new Function('require', 'module', 'exports', jsCode);
  fn(customRequire, moduleObj, exportsObj);

  // Get the schema from exports
  const exports = moduleObj.exports as Record<string, unknown>;
  const schema = exports.schema || exports.default;

  if (!schema) {
    throw new Error('Schema was not exported from code');
  }

  return schema as GraphQLSchema;
}

/**
 * Run all tests
 */
async function main() {
  console.log('Type-checking playground examples...\n');

  const examples = await loadExamples();

  let passedCount = 0;
  let failedCount = 0;
  const failedExamples: Array<{
    name: string;
    schemaErrors?: TypeCheckResult['errors'];
    queryErrors?: Array<{ file: string; errors: string[] }>;
  }> = [];

  for (const example of examples) {
    if (!example?.title) {
      console.warn('Warning: Invalid example found:', example);
      continue;
    }

    // Extract code from the first file (schema.ts)
    const schemaFile = example.files?.find(
      (f: { filename: string; content: string }) => f.filename === 'schema.ts',
    );
    if (!schemaFile?.content) {
      console.warn(`Warning: No schema.ts file found for ${example.title}`);
      continue;
    }

    const code = schemaFile.content;

    console.log(`\n📝 Testing: ${example.title}`);
    console.log('─'.repeat(60));

    // Extract plugin imports from EVERY file in the bundle — for
    // multi-file step bundles the @pothos/plugin-* imports live in
    // builder.ts, not schema.ts. Scanning only the entry would skip
    // the plugin type augmentations and `builder.prismaObject` would
    // come up undefined.
    const allBundleSource = (example.files ?? [])
      .map((f: { content: string }) => f.content)
      .join('\n');
    const pluginImports = extractPluginImports(allBundleSource);

    if (pluginImports.length > 0) {
      console.log(`   Plugins: ${pluginImports.join(', ')}`);
    }

    // Multi-file step bundles also need sibling source files in the
    // type-check program so `schema.ts`'s relative imports resolve.
    const siblings = (example.files ?? []).filter(
      (f: { filename: string }) => f.filename !== 'schema.ts',
    );

    // Type check the code
    const schemaResult = typeCheckCode(code, pluginImports, siblings);
    const hasSchemaErrors = !schemaResult.success;

    if (!schemaResult.success) {
      console.log('   ❌ Schema type check FAILED');
      console.log('\n   Schema Errors:');
      for (const error of schemaResult.errors) {
        console.log(`   ${error.file}:${error.line}:${error.column} - ${error.message}`);
      }
    } else {
      console.log('   ✅ Schema type check passed');
    }

    // Test all query files for this example
    let hasQueryErrors = false;
    const queryErrors: Array<{ file: string; errors: string[] }> = [];

    // Find all .graphql files in the example directory
    const examplePath = path.join(__dirname, '../playground-examples', example.id);
    let queryFiles: string[] = [];
    try {
      const files = await readdir(examplePath);
      queryFiles = files.filter((f) => f.endsWith('.graphql'));
    } catch {
      // Directory might not exist or be readable
    }

    if (queryFiles.length > 0) {
      console.log(`   🔍 Testing ${queryFiles.length} query file(s)...`);

      for (const queryFile of queryFiles) {
        const queryPath = path.join(examplePath, queryFile);
        const queryContent = await readFile(queryPath, 'utf-8');

        if (queryContent.trim()) {
          const queryResult = testQuery(code, queryContent, pluginImports);

          if (!queryResult.success) {
            hasQueryErrors = true;
            queryErrors.push({ file: queryFile, errors: queryResult.errors });
            console.log(`   ❌ ${queryFile}: validation FAILED`);
            for (const error of queryResult.errors) {
              console.log(`      - ${error}`);
            }
          } else {
            console.log(`   ✅ ${queryFile}: validation passed`);
          }
        }
      }
    }

    // Overall result
    if (!hasSchemaErrors && !hasQueryErrors) {
      console.log('\n   ✅ PASSED');
      passedCount++;
    } else {
      console.log('\n   ❌ FAILED');
      failedCount++;
      failedExamples.push({
        name: example.title,
        schemaErrors: hasSchemaErrors ? schemaResult.errors : undefined,
        queryErrors: hasQueryErrors ? queryErrors : undefined,
      });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`\nTest Results: ${passedCount} passed, ${failedCount} failed\n`);

  if (failedCount > 0) {
    console.log('Failed examples:');
    for (const example of failedExamples) {
      console.log(`\n  ${example.name}:`);
      if (example.schemaErrors) {
        console.log('    Schema errors:');
        for (const error of example.schemaErrors) {
          console.log(`      Line ${error.line}: ${error.message}`);
        }
      }
      if (example.queryErrors) {
        console.log('    Query errors:');
        for (const queryError of example.queryErrors) {
          console.log(`      ${queryError.file}:`);
          for (const error of queryError.errors) {
            console.log(`        - ${error}`);
          }
        }
      }
    }
    process.exit(1);
  }
}

main();
