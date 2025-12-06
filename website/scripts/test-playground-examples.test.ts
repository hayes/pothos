/**
 * Script to type-check playground examples using TypeScript compiler API
 * Run with: npx tsx scripts/test-playground-examples.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import * as ts from 'typescript';
import { getCoreTypeDefinitions, getPluginTypeDefinitions } from '../lib/playground/pothos-types';

// Load examples from individual directories
async function loadExamples() {
  const examplesDir = path.join(__dirname, '../public/playground-examples');
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
 * Test GraphQL query validation
 */
function testQuery(_code: string, query: string): { success: boolean; errors: string[] } {
  try {
    // For now, we'll just check basic GraphQL syntax
    // Full validation would require executing the code and building the schema
    const errors: string[] = [];

    // Basic syntax checks
    if (!query.trim()) {
      errors.push('Query is empty');
    }

    // Check for balanced braces
    const openBraces = (query.match(/{/g) || []).length;
    const closeBraces = (query.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push(`Unbalanced braces: ${openBraces} open, ${closeBraces} close`);
    }

    return { success: errors.length === 0, errors };
  } catch (error) {
    return { success: false, errors: [error instanceof Error ? error.message : String(error)] };
  }
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
    queryErrors?: string[];
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

    // Test the default query if present
    let hasQueryErrors = false;
    let queryErrors: string[] = [];

    if (example.defaultQuery?.trim()) {
      console.log('   🔍 Testing default query...');
      const queryResult = testQuery(code, example.defaultQuery);

      if (!queryResult.success) {
        hasQueryErrors = true;
        queryErrors = queryResult.errors;
        console.log('   ❌ Query validation FAILED');
        console.log('\n   Query Errors:');
        for (const error of queryResult.errors) {
          console.log(`   - ${error}`);
        }
      } else {
        console.log('   ✅ Query validation passed');
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
        for (const error of example.queryErrors) {
          console.log(`      ${error}`);
        }
      }
    }
    process.exit(1);
  }
}

main();
