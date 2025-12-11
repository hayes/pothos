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

// Load examples from individual directories
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

    // Read schema.ts
    const schemaPath = path.join(examplePath, 'schema.ts');
    const schemaContent = await readFile(schemaPath, 'utf-8');

    // Read query.graphql (optional)
    let queryContent = '';
    try {
      const queryPath = path.join(examplePath, 'query.graphql');
      queryContent = await readFile(queryPath, 'utf-8');
    } catch {
      // Query file is optional
    }

    examples.push({
      id: metadata.id,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags || [],
      files: [
        {
          filename: 'schema.ts',
          content: schemaContent,
          language: 'typescript',
        },
      ],
      defaultQuery: queryContent || '{\n  # Add your query here\n}',
    });
  }

  return examples.sort((a, b) => a.id.localeCompare(b.id));
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
 * Create a TypeScript program from type definitions and test code
 */
function typeCheckCode(code: string, pluginNames: string[]): TypeCheckResult {
  const errors: TypeCheckResult['errors'] = [];

  // Get all type definitions
  const coreTypes = getCoreTypeDefinitions();
  const pluginTypes = pluginNames.flatMap((name) => getPluginTypeDefinitions(name));
  const allTypes = [...coreTypes, ...pluginTypes];

  // Create a map of file paths to content
  const fileMap = new Map<string, string>();

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

  // Add module resolution support
  host.resolveModuleNames = (moduleNames, _containingFile) => {
    return moduleNames.map((moduleName) => {
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

  // Create the program
  const program = ts.createProgram(['test.ts'], compilerOptions, host);

  // Get diagnostics
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // Process diagnostics
  for (const diagnostic of diagnostics) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);

        // Only report errors from the test file, not from type definitions
        if (diagnostic.file.fileName === 'test.ts') {
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
    if (!example || !example.title) {
      console.warn('Warning: Invalid example found:', example);
      continue;
    }

    // Extract code from the first file (schema.ts)
    const schemaFile = example.files?.find(
      (f: { filename: string; content: string }) => f.filename === 'schema.ts',
    );
    if (!schemaFile || !schemaFile.content) {
      console.warn(`Warning: No schema.ts file found for ${example.title}`);
      continue;
    }

    const code = schemaFile.content;

    console.log(`\n📝 Testing: ${example.title}`);
    console.log('─'.repeat(60));

    // Extract plugin imports
    const pluginImports = extractPluginImports(code);

    if (pluginImports.length > 0) {
      console.log(`   Plugins: ${pluginImports.join(', ')}`);
    }

    // Type check the code
    const schemaResult = typeCheckCode(code, pluginImports);
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
