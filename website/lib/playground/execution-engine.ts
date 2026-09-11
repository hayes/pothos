import * as esbuild from 'esbuild-wasm';
import { type GraphQLSchema, printSchema } from 'graphql';
import { fetchCdnModule } from './cdn-modules';
import { compileTypeScriptInWorker } from './compiler-worker-client';
import { captureConsole } from './console-capture';
import { errorMessage } from './error-message';
import { getExampleStubModules } from './example-stubs';
import { compilerLogger } from './logger';
import { pluginModules } from './plugins-bundle';
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

  // Pull the matching wasm for the JS API actually installed — the
  // wasm and JS must be the same esbuild release or transform() hangs
  // silently after init.
  initPromise = esbuild
    .initialize({
      wasmURL: `https://unpkg.com/esbuild-wasm@${esbuild.version}/esbuild.wasm`,
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
      compilerLogger.debug('Using cached compilation');
      return {
        success: true,
        code: cachedCode,
      };
    }
  } catch (err) {
    // Cache errors are non-fatal, continue with compilation
    compilerLogger.warn('Cache read failed:', err);
  }

  // Try worker-based compilation first
  if (useWorkerCompilation && typeof Worker !== 'undefined') {
    try {
      const result = await compileTypeScriptInWorker(code, filename);

      // Cache successful compilation
      if (result.success && result.code) {
        setCachedSchema(code, result.code).catch((err) => {
          compilerLogger.warn('Failed to cache compilation:', err);
        });
      }

      return result;
    } catch (err) {
      compilerLogger.warn('Worker compilation failed, falling back to main thread:', err);
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
      compilerLogger.warn('Failed to cache compilation:', err);
    });

    return {
      success: true,
      code: result.code,
    };
  } catch (err) {
    return {
      success: false,
      error: errorMessage(err),
    };
  }
}

// User code runs via `new Function()` on the main thread (see comment
// at the call site below). There is no real way to bound execution
// time in this context: a `setTimeout`-based timeout cannot fire
// during a synchronous user-code call because the event loop is
// blocked. If we ever need a real budget for sync user code, the
// schema build needs to move into a Worker so it can be terminated.
// For now we rely on the browser's slow-script dialog as the backstop.

export async function executeAndBuildSchema(
  compiledCode: string,
  modules: PlaygroundModules,
  additionalModules: Record<string, unknown> = {},
): Promise<ExecutionResult> {
  // Logs accumulate into this array even if user code throws — both
  // captureConsole (via `out`) and our catch below read from it, so a
  // failed schema build still surfaces any preceding console output.
  const logs: ConsoleMessage[] = [];

  try {
    // Let esbuild lower module syntax instead of rewriting JavaScript with
    // regular expressions (which also match strings and miss multiline imports).
    await initEsbuild();
    const compiled = await esbuild.build({
      stdin: { contents: compiledCode, loader: 'js' },
      bundle: true,
      external: ['*'],
      format: 'cjs',
      platform: 'neutral',
      target: 'es2020',
      write: false,
      metafile: true,
    });
    const moduleMap: Record<string, unknown> = {
      '@pothos/core': modules['@pothos/core'],
      graphql: modules.graphql,
      ...additionalModules,
    };
    // Use the parser's dependency list: import-like text inside strings must
    // neither trigger a network request nor be rewritten as executable code.
    const imports = new Set(
      Object.values(compiled.metafile.outputs).flatMap((output) =>
        output.imports.map((entry) => entry.path),
      ),
    );
    await Promise.all(
      [...imports].filter((name) => !Object.hasOwn(moduleMap, name)).map(async (name) => {
        moduleMap[name] = await fetchCdnModule(name);
      }),
    );
    const { result } = captureConsole(() => {
      const requireModule = (name: string) => {
        if (!Object.hasOwn(moduleMap, name)) {
          throw new Error(`Module not found: ${name}`);
        }
        const value = moduleMap[name];
        if (value == null || (typeof value !== 'object' && typeof value !== 'function')) {
          return value;
        }
        // These are ESM namespaces, including the locally assembled core
        // namespace. Mark them as such for esbuild's CommonJS interop helper.
        const namespace = value as Record<string, unknown>;
        const fallback = namespace.default;
        return new Proxy(Object.create(null) as Record<string, unknown>, {
          get(_target, prop) {
            if (prop === '__esModule') {
              return true;
            }
            const exported = Reflect.get(namespace, prop);
            if (exported !== undefined) {
              return exported;
            }
            // Some CDN CommonJS wrappers expose named exports only on default.
            return fallback != null &&
              (typeof fallback === 'object' || typeof fallback === 'function')
              ? Reflect.get(fallback, prop)
              : undefined;
          },
          ownKeys: () => Reflect.ownKeys(namespace),
          getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
        });
      };
      const module = { exports: {} as Record<string, unknown> };
      // This still executes in the page origin. URL-supplied code must be
      // explicitly trusted by the user before reaching this function.
      const fn = new Function('require', 'module', 'exports', compiled.outputFiles[0].text);
      fn(requireModule, module, module.exports);
      return module.exports;
    }, logs);

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
    return {
      success: false,
      error: errorMessage(err),
      consoleLogs: logs,
    };
  }
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
      plugins: [
        {
          name: 'virtual-files',
          setup(build) {
            // Resolve relative imports to our virtual file system.
            // Known data-file extensions (`.json`, `.sql`) pass through
            // unchanged so the loader below can pick the right
            // esbuild loader; everything else gets the implicit `.ts`.
            build.onResolve({ filter: /^\./ }, (args) => {
              let path = args.path.replace(/^\.\//, '');
              const isDataFile = path.endsWith('.json') || path.endsWith('.sql');
              if (!isDataFile && !path.endsWith('.ts') && !path.endsWith('.tsx')) {
                path += '.ts';
              }
              return { path: `/playground/${path}`, namespace: 'virtual' };
            });

            // Bare specifiers (everything not starting with `.` or `/`)
            // are runtime-resolved: pothos workspace plugins come from
            // `plugins-bundle`, example-registered stubs come from
            // `example-stubs`, and anything else is fetched from
            // esm.sh by `compileAndExecute`. Marking them external
            // here keeps esbuild from trying to walk node_modules
            // (which doesn't exist in the WASM context).
            build.onResolve({ filter: /^[^./]/ }, (args) => ({
              path: args.path,
              external: true,
            }));

            // Load files from our virtual file system. `.json` →
            // esbuild's json loader (parses + emits a JS module with
            // default-export object); `.sql` → text loader (emits the
            // raw content as a default string). Everything else is
            // TypeScript.
            build.onLoad({ filter: /.*/, namespace: 'virtual' }, (args) => {
              const contents = fileMap.get(args.path);
              if (contents === undefined) {
                return { errors: [{ text: `File not found: ${args.path}` }] };
              }
              const loader: 'json' | 'text' | 'ts' = args.path.endsWith('.json')
                ? 'json'
                : args.path.endsWith('.sql')
                  ? 'text'
                  : 'ts';
              return { contents, loader };
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
    // Don't fall back to a naïve concat — relative imports between
    // user files would survive as `import './builder'` and the
    // downstream `__require` rewriter would throw "Module not found"
    // anyway, just with a less actionable error. Surface the real
    // bundle failure to the caller.
    throw new Error(`Bundle failed: ${errorMessage(err)}`);
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

  // Pothos plugins are workspace packages — bundled locally so the
  // playground always runs the same version that ships with the docs.
  // Examples can additionally register "stub" modules (synthetic
  // specifiers mapped to in-tree implementations) via
  // `registerExampleStubs`; those resolve from the registry instead of
  // the CDN. Everything else (zod, lodash, anything the user types)
  // goes through the esm.sh CDN at runtime; ATA fetches matching types
  // at edit time.
  const stubModules = getExampleStubModules(code);

  const compilationResult = await compileTypeScript(code, filename);

  if (!compilationResult.success) {
    return {
      success: false,
      error: `Compilation error: ${compilationResult.error}`,
    };
  }

  return executeAndBuildSchema(compilationResult.code!, modules, {
    ...pluginModules,
    ...stubModules,
  });
}
