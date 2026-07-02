import * as esbuild from 'esbuild-wasm';
import { type GraphQLSchema, printSchema } from 'graphql';
import { extractBareImports, fetchCdnModule } from './cdn-modules';
import { compileTypeScriptInWorker } from './compiler-worker-client';
import { captureConsole } from './console-capture';
import { errorMessage } from './error-message';
import { compilerLogger } from './logger';
import { getExampleStubModules } from './example-stubs';
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

export function executeAndBuildSchema(
  compiledCode: string,
  modules: PlaygroundModules,
  additionalModules: Record<string, unknown> = {},
): ExecutionResult {
  // Logs accumulate into this array even if user code throws — both
  // captureConsole (via `out`) and our catch below read from it, so a
  // failed schema build still surfaces any preceding console output.
  const logs: ConsoleMessage[] = [];

  try {
    const { result } = captureConsole(() => {
      const moduleMap: Record<string, unknown> = {
        '@pothos/core': modules['@pothos/core'],
        graphql: modules.graphql,
        ...additionalModules,
      };

      // __interop bridges the CJS/ESM gap that esm.sh leaves behind:
      // when esm.sh serves a CJS package (lodash, etc.) it puts the
      // original module on \`.default\` and synthesizes named exports
      // as live bindings. Some of those bindings resolve to undefined
      // even though the property exists on \`default\` — copying eagerly
      // (via \`Object.assign\`) misses them entirely. We instead Proxy
      // \`default\` and prefer named-export values when they're
      // actually defined, falling back to \`default\`'s own property
      // for everything else. Both \`x.add\` and \`{ add } = x\` resolve
      // through the same get trap, so the two forms agree.
      const wrappedCode = `
        const __exports = {};
        const __require = (name) => {
          if (!__modules[name]) throw new Error('Module not found: ' + name);
          return __modules[name];
        };
        const __interop = (m) => {
          if (m == null || typeof m !== 'object') return m;
          const def = m.default;
          if (def == null || (typeof def !== 'object' && typeof def !== 'function')) {
            return m;
          }
          return new Proxy(def, {
            get(target, prop, receiver) {
              if (typeof prop === 'string' && prop in m) {
                const v = m[prop];
                if (v !== undefined) return v;
              }
              return Reflect.get(target, prop, receiver);
            },
            has(target, prop) {
              if (
                typeof prop === 'string' &&
                prop in m &&
                m[prop] !== undefined
              ) {
                return true;
              }
              return Reflect.has(target, prop);
            },
          });
        };

        ${rewriteImports(compiledCode)}

        return __exports;
      `;

      // SECURITY: `new Function()` runs user code in the page origin
      // with full access to window/document/fetch/cookies. URL-shared
      // playground links carry executable code; clicking one runs JS
      // under pothos.dev. Acceptable for first-party authoring; before
      // accepting third-party shares without friction, consider moving
      // execution into a sandboxed iframe or a separate origin and
      // postMessage'ing the SDL back.
      const fn = new Function('__modules', wrappedCode);
      return fn(moduleMap);
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

// Regex-based import rewriter — intentionally not a real parser. The playground
// only executes trusted user code, and the supported import shapes are well-bounded.
function rewriteImports(code: string): string {
  let rewritten = code;

  // Handle re-exports first: `export { x } from 'mod'` and `export { x as y } from 'mod'`.
  // Must run before the bare `export { x }` rewriter below, otherwise that
  // rewriter would match the `{ x }` portion and emit refs to undeclared `x`.
  const reExportRegex = /export\s*\{\s*([^}]+)\s*\}\s*from\s*['"]([^'"]+)['"]/g;
  rewritten = rewritten.replace(reExportRegex, (_match, names: string, moduleName: string) => {
    const parts = names.split(',').map((n: string) => {
      const [name, alias] = n.trim().split(/\s+as\s+/);
      return `__exports.${alias || name} = __require('${moduleName}').${name}`;
    });
    return parts.join(';\n');
  });

  // Handle import statements - match more carefully
  const importRegex = /import\s+(.+?)\s+from\s*['"]([^'"]+)['"]/g;

  rewritten = rewritten.replace(importRegex, (_match, imports, moduleName) => {
    const cleanImports = imports.trim();

    // Namespace import: `import * as Foo from 'module'`. esm.sh's
    // CJS-namespace wrappers advertise named keys (so `Object.keys(x)`
    // looks right) but the live-binding accessors don't actually
    // surface values for callable-CJS modules like lodash — `x.add`
    // ends up `undefined` while `Object.keys(x).includes('add')` is
    // true. Routing through interop builds a flat namespace that
    // matches what users expect from `* as`.
    const nsMatch = cleanImports.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)$/);
    if (nsMatch) {
      return `const ${nsMatch[1]} = __interop(__require('${moduleName}'))`;
    }

    // Mixed namespace: `import Foo, * as Bar from 'module'`
    const mixedNsMatch = cleanImports.match(
      /^([A-Za-z_$][\w$]*)\s*,\s*\*\s+as\s+([A-Za-z_$][\w$]*)$/,
    );
    if (mixedNsMatch) {
      return `const ${mixedNsMatch[1]} = __require('${moduleName}').default ?? __require('${moduleName}');\nconst ${mixedNsMatch[2]} = __interop(__require('${moduleName}'))`;
    }

    // Named imports only: `import { a, b } from 'module'` — run
    // through interop so CJS-wrapped packages (`{ add } from 'lodash'`)
    // work without forcing the user to write `import lodash from …`.
    if (cleanImports.startsWith('{') && cleanImports.endsWith('}')) {
      return `const ${cleanImports} = __interop(__require('${moduleName}'))`;
    }

    // Default import: `import Foo from 'module'`
    if (!cleanImports.includes('{') && !cleanImports.includes(',')) {
      return `const ${cleanImports} = __require('${moduleName}').default ?? __require('${moduleName}')`;
    }

    // Mixed: `import Foo, { a, b } from 'module'`
    const commaIndex = cleanImports.indexOf(',');
    if (commaIndex > 0) {
      const defaultImport = cleanImports.substring(0, commaIndex).trim();
      const namedImports = cleanImports.substring(commaIndex + 1).trim();
      return `const ${defaultImport} = __require('${moduleName}').default ?? __require('${moduleName}');\nconst ${namedImports} = __interop(__require('${moduleName}'))`;
    }

    // Fallback - shouldn't reach here
    return `const ${cleanImports} = __require('${moduleName}')`;
  });

  // Handle export default
  const exportDefaultSchemaRegex = /export\s+default\s+(\w+)/g;
  rewritten = rewritten.replace(exportDefaultSchemaRegex, '__exports.default = $1');

  // Handle export const - need to track which consts were exported.
  // Only plain identifier forms (`export const foo = ...`) are tracked; for
  // destructuring forms (`export const { a } = ...` or `export const [a] = ...`)
  // we can't know which identifiers are bound without parsing, so we leave
  // those alone — the `export const` -> `const` replacement below still strips
  // the keyword so the destructure executes; the user just won't get the
  // bindings re-exported on `__exports`. That's acceptable for the playground.
  const exportedConsts = new Set<string>();
  const exportConstRegex = /export\s+const\s+(\w+)\s*=/g;
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

  // Handle export { name } (without `from`) — re-export `from` form was
  // already handled above and stripped.
  const exportNamedRegex = /export\s+\{\s*([^}]+)\s*\}(?!\s*from)/g;
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
  const pluginModules = getPluginModules(code);
  const stubModules = getExampleStubModules(code);

  const compilationResult = await compileTypeScript(code, filename);

  if (!compilationResult.success) {
    return {
      success: false,
      error: `Compilation error: ${compilationResult.error}`,
    };
  }

  const knownLocally = new Set<string>([
    '@pothos/core',
    'graphql',
    ...Object.keys(pluginModules),
    ...Object.keys(stubModules),
  ]);
  const cdnModules: Record<string, unknown> = {};
  const remoteSpecifiers = [...extractBareImports(compilationResult.code!)].filter(
    (name) => !knownLocally.has(name),
  );
  if (remoteSpecifiers.length > 0) {
    const fetched = await Promise.allSettled(
      remoteSpecifiers.map(async (name) => [name, await fetchCdnModule(name)] as const),
    );
    const failed: string[] = [];
    for (let i = 0; i < fetched.length; i++) {
      const settled = fetched[i];
      if (settled.status === 'fulfilled') {
        cdnModules[settled.value[0]] = settled.value[1];
      } else {
        failed.push(remoteSpecifiers[i]);
        compilerLogger.warn(`Failed to load '${remoteSpecifiers[i]}' from esm.sh:`, settled.reason);
      }
    }
    if (failed.length > 0) {
      return {
        success: false,
        error: `Failed to load ${failed.length === 1 ? 'package' : 'packages'} from esm.sh: ${failed.join(', ')}`,
      };
    }
  }

  return executeAndBuildSchema(compilationResult.code!, modules, {
    ...pluginModules,
    ...stubModules,
    ...cdnModules,
  });
}
