import * as esbuild from 'esbuild-wasm';
import { type GraphQLSchema, printSchema } from 'graphql';
import { compileTypeScriptInWorker } from './compiler-worker-client';
import { captureConsole } from './console-capture';
import { getDependencyModules } from './dependencies-bundle';
import { getPluginModules } from './plugins-bundle';
import { getCachedSchema, setCachedSchema } from './schema-cache';

let esbuildInitialized = false;
let initPromise: Promise<void> | null = null;

async function initEsbuild(): Promise<void> {
  if (esbuildInitialized) {
    return;
  }
  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = esbuild
    .initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.1/esbuild.wasm',
    })
    .then(() => {
      esbuildInitialized = true;
    })
    .catch((err) => {
      // Reset on error so we can retry
      initPromise = null;
      throw err;
    });

  await initPromise;
}

export interface CompilationResult {
  success: boolean;
  code?: string;
  error?: string;
}

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info';
  args: unknown[];
  timestamp: number;
}

export interface ExecutionResult {
  success: boolean;
  schema?: GraphQLSchema;
  schemaSDL?: string;
  error?: string;
  consoleLogs?: ConsoleMessage[];
}

export interface PlaygroundModules {
  '@pothos/core': unknown;
  graphql: unknown;
}

export async function compileTypeScript(
  code: string,
  filename = 'schema.ts',
  useWorkerCompilation = true,
): Promise<CompilationResult> {
  // Check cache first
  try {
    const cachedCode = await getCachedSchema(code);
    if (cachedCode) {
      console.log('[Compiler] Using cached compilation');
      return {
        success: true,
        code: cachedCode,
      };
    }
  } catch (err) {
    // Cache errors are non-fatal, continue with compilation
    console.warn('[Compiler] Cache read failed:', err);
  }

  // Try worker-based compilation first
  if (useWorkerCompilation && typeof Worker !== 'undefined') {
    try {
      const result = await compileTypeScriptInWorker(code, filename);

      // Cache successful compilation
      if (result.success && result.code) {
        setCachedSchema(code, result.code).catch((err) => {
          console.warn('[Compiler] Failed to cache compilation:', err);
        });
      }

      return result;
    } catch (err) {
      console.warn('[Compiler] Worker compilation failed, falling back to main thread:', err);
      // Fall through to main thread compilation
    }
  }

  // Fallback to main thread compilation
  try {
    await initEsbuild();

    const result = await esbuild.transform(code, {
      loader: filename.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'es2020',
      sourcemap: false,
    });

    // Cache successful compilation
    setCachedSchema(code, result.code).catch((err) => {
      console.warn('[Compiler] Failed to cache compilation:', err);
    });

    return {
      success: true,
      code: result.code,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Execute user code with timeout protection
 *
 * Note: This provides a basic timeout mechanism but cannot interrupt
 * truly synchronous infinite loops. The timeout will fire after the
 * specified time, but the loop will continue running until it completes
 * or the browser's execution limit is reached.
 *
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @returns Execution result
 * @throws Error if execution takes longer than timeout
 */
function executeWithTimeout<T>(fn: () => T, timeoutMs = 5000): T {
  let completed = false;
  let result: T | undefined;
  let error: Error | null = null;

  // Set up timeout - this will throw after timeoutMs
  const timeoutId = setTimeout(() => {
    if (!completed) {
      error = new Error(
        `Execution timeout after ${timeoutMs}ms. Check for infinite loops or very slow operations.`,
      );
    }
  }, timeoutMs);

  try {
    // Execute the function synchronously
    result = fn();
    completed = true;
    clearTimeout(timeoutId);

    // If timeout already fired, throw the error
    if (error) {
      throw error;
    }

    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    // Re-throw timeout error or original error
    throw error || err;
  }
}

export function executeAndBuildSchema(
  compiledCode: string,
  modules: PlaygroundModules,
  additionalModules: Record<string, unknown> = {},
): ExecutionResult {
  try {
    // Use safe console capture utility with timeout protection
    const { result, logs } = captureConsole(() => {
      return executeWithTimeout(() => {
        const moduleMap: Record<string, unknown> = {
          '@pothos/core': modules['@pothos/core'],
          graphql: modules.graphql,
          ...additionalModules,
        };

        const wrappedCode = `
          const __exports = {};
          const __require = (name) => {
            if (!__modules[name]) throw new Error('Module not found: ' + name);
            return __modules[name];
          };

          ${rewriteImports(compiledCode)}

          return __exports;
        `;

        // Note: Using Function constructor for code execution
        // This is intentional for the playground but has security implications
        // User code is sandboxed with timeout and limited module access
        const fn = new Function('__modules', wrappedCode);
        return fn(moduleMap);
      }, 5000);
    });

    if (!result.schema) {
      return {
        success: false,
        error:
          'No schema export found. Make sure to export your schema: export const schema = builder.toSchema()',
        consoleLogs: logs,
      };
    }

    const schema = result.schema as GraphQLSchema;
    const schemaSDL = printSchema(schema);

    return {
      success: true,
      schema,
      schemaSDL,
      consoleLogs: logs,
    };
  } catch (err) {
    const error = err as Error;

    // Check if this was a timeout error
    if (error.message.includes('timeout')) {
      return {
        success: false,
        error: `⏱️  ${error.message}`,
        consoleLogs: [],
      };
    }

    return {
      success: false,
      error: error.message,
      consoleLogs: [],
    };
  }
}

function rewriteImports(code: string): string {
  let rewritten = code;

  // Handle import statements - match more carefully
  const importRegex = /import\s+(.+?)\s+from\s*['"]([^'"]+)['"]/g;

  rewritten = rewritten.replace(importRegex, (_match, imports, moduleName) => {
    const cleanImports = imports.trim();

    // Named imports only: import { a, b } from 'module'
    if (cleanImports.startsWith('{') && cleanImports.endsWith('}')) {
      return `const ${cleanImports} = __require('${moduleName}')`;
    }

    // Default import only: import Foo from 'module'
    if (!cleanImports.includes('{') && !cleanImports.includes(',')) {
      return `const ${cleanImports} = __require('${moduleName}').default || __require('${moduleName}')`;
    }

    // Mixed import: import Foo, { a, b } from 'module'
    const commaIndex = cleanImports.indexOf(',');
    if (commaIndex > 0) {
      const defaultImport = cleanImports.substring(0, commaIndex).trim();
      const namedImports = cleanImports.substring(commaIndex + 1).trim();
      return `const ${defaultImport} = __require('${moduleName}').default || __require('${moduleName}');\nconst ${namedImports} = __require('${moduleName}')`;
    }

    // Fallback - shouldn't reach here
    return `const ${cleanImports} = __require('${moduleName}')`;
  });

  // Handle export default
  const exportDefaultSchemaRegex = /export\s+default\s+(\w+)/g;
  rewritten = rewritten.replace(exportDefaultSchemaRegex, '__exports.default = $1');

  // Handle export const - need to track which consts were exported
  const exportedConsts = new Set<string>();
  const exportConstRegex = /export\s+const\s+(\w+)/g;
  let match: RegExpExecArray | null = exportConstRegex.exec(code);
  while (match !== null) {
    exportedConsts.add(match[1]);
    match = exportConstRegex.exec(code);
  }

  // Remove export keyword but keep const declaration
  rewritten = rewritten.replace(/export\s+const\s+/g, 'const ');

  // Find all const declarations and add exports for the ones that were originally exported
  // We need to do this at the end of the code
  const constMatches: string[] = [];
  for (const constName of Array.from(exportedConsts)) {
    constMatches.push(`__exports.${constName} = ${constName};`);
  }

  // Append all export assignments at the end
  if (constMatches.length > 0) {
    rewritten = `${rewritten}\n${constMatches.join('\n')}`;
  }

  // Handle export { name }
  const exportNamedRegex = /export\s+\{\s*([^}]+)\s*\}/g;
  rewritten = rewritten.replace(exportNamedRegex, (_match, names) => {
    const exports = names.split(',').map((n: string) => {
      const [name, alias] = n.trim().split(/\s+as\s+/);
      return `__exports.${alias || name} = ${name}`;
    });
    return exports.join(';\n');
  });

  return rewritten;
}

/**
 * Bundle multiple files together using esbuild
 * This handles all import/export transformations and module resolution
 */
async function bundleFiles(files: Array<{ filename: string; content: string }>): Promise<string> {
  if (files.length === 1) {
    return files[0].content;
  }

  await initEsbuild();

  // Find the main file (schema.ts or first file)
  const mainFile = files.find((f) => f.filename === 'schema.ts') || files[0];

  // Create a virtual file system for esbuild
  const fileMap = new Map<string, string>();
  for (const file of files) {
    fileMap.set(`/playground/${file.filename}`, file.content);
  }

  try {
    // Use esbuild to bundle with a custom plugin that provides our virtual files
    const result = await esbuild.build({
      stdin: {
        contents: mainFile.content,
        sourcefile: mainFile.filename,
        resolveDir: '/playground',
        loader: 'ts',
      },
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2020',
      platform: 'neutral',
      // Mark external packages that will be provided by the playground runtime
      external: ['@pothos/*', 'graphql', 'zod'],
      plugins: [
        {
          name: 'virtual-files',
          setup(build) {
            // Resolve relative imports to our virtual file system
            build.onResolve({ filter: /^\./ }, (args) => {
              // Remove leading './' and add file extension if missing
              let path = args.path.replace(/^\.\//, '');
              if (!path.endsWith('.ts') && !path.endsWith('.tsx')) {
                path += '.ts';
              }
              return { path: `/playground/${path}`, namespace: 'virtual' };
            });

            // Load files from our virtual file system
            build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
              const contents = fileMap.get(args.path);
              if (contents === undefined) {
                return { errors: [{ text: `File not found: ${args.path}` }] };
              }
              return { contents, loader: 'ts' };
            });
          },
        },
      ],
    });

    if (result.errors.length > 0) {
      throw new Error(`Bundle errors: ${result.errors.map((e) => e.text).join(', ')}`);
    }

    // Return the bundled code
    return new TextDecoder().decode(result.outputFiles[0].contents);
  } catch (err) {
    // If esbuild fails, fall back to simple concatenation with a warning
    console.warn('[Bundler] esbuild bundling failed, using fallback:', err);
    return files.map((f) => f.content).join('\n\n');
  }
}

export interface CompileAndExecuteOptions {
  files?: Array<{ filename: string; content: string }>;
  code?: string;
  modules: PlaygroundModules;
  filename?: string;
}

export async function compileAndExecute(
  codeOrOptions: string | CompileAndExecuteOptions,
  modulesLegacy?: PlaygroundModules,
  filenameLegacy = 'schema.ts',
): Promise<ExecutionResult> {
  // Support both old and new API
  let code: string;
  let modules: PlaygroundModules;
  let filename: string;
  let files: Array<{ filename: string; content: string }> | undefined;

  if (typeof codeOrOptions === 'string') {
    // Legacy API: compileAndExecute(code, modules, filename)
    code = codeOrOptions;
    modules = modulesLegacy!;
    filename = filenameLegacy;
  } else {
    // New API: compileAndExecute({ files, modules })
    const options = codeOrOptions;
    modules = options.modules;
    filename = options.filename || 'schema.ts';
    files = options.files;

    if (files && files.length > 0) {
      // Bundle multiple files together
      code = await bundleFiles(files);
    } else if (options.code) {
      code = options.code;
    } else {
      return {
        success: false,
        error: 'No code or files provided',
      };
    }
  }

  // Load any plugins and dependencies used in the code
  const pluginModules = getPluginModules(code);
  const dependencyModules = getDependencyModules(code);

  const compilationResult = await compileTypeScript(code, filename);

  if (!compilationResult.success) {
    return {
      success: false,
      error: `Compilation error: ${compilationResult.error}`,
    };
  }

  return executeAndBuildSchema(compilationResult.code!, modules, {
    ...pluginModules,
    ...dependencyModules,
  });
}
