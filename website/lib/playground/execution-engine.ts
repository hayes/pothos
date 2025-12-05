import * as esbuild from 'esbuild-wasm';
import { printSchema, type GraphQLSchema } from 'graphql';

let esbuildInitialized = false;
let initPromise: Promise<void> | null = null;

async function initEsbuild(): Promise<void> {
  if (esbuildInitialized) return;
  if (initPromise) return initPromise;

  initPromise = esbuild.initialize({
    wasmURL: 'https://unpkg.com/esbuild-wasm@0.27.1/esbuild.wasm',
  });

  await initPromise;
  esbuildInitialized = true;
}

export interface CompilationResult {
  success: boolean;
  code?: string;
  error?: string;
}

export interface ExecutionResult {
  success: boolean;
  schema?: GraphQLSchema;
  schemaSDL?: string;
  error?: string;
}

export interface PlaygroundModules {
  '@pothos/core': unknown;
  graphql: unknown;
}

export async function compileTypeScript(
  code: string,
  filename = 'schema.ts'
): Promise<CompilationResult> {
  try {
    await initEsbuild();

    const result = await esbuild.transform(code, {
      loader: filename.endsWith('.tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'es2020',
      sourcemap: false,
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

export async function executeAndBuildSchema(
  compiledCode: string,
  modules: PlaygroundModules
): Promise<ExecutionResult> {
  try {
    const moduleMap: Record<string, unknown> = {
      '@pothos/core': modules['@pothos/core'],
      graphql: modules.graphql,
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

    const fn = new Function('__modules', wrappedCode);
    const exports = fn(moduleMap);

    if (!exports.schema) {
      return {
        success: false,
        error: 'No schema export found. Make sure to export your schema: export const schema = builder.toSchema()',
      };
    }

    const schema = exports.schema as GraphQLSchema;
    const schemaSDL = printSchema(schema);

    return {
      success: true,
      schema,
      schemaSDL,
    };
  } catch (err) {
    const error = err as Error;
    return {
      success: false,
      error: error.message,
    };
  }
}

function rewriteImports(code: string): string {
  let rewritten = code;

  const importRegex = /import\s+(\{[^}]+\}|[^,{]+(?:\s*,\s*\{[^}]+\})?)\s+from\s*['"]([^'"]+)['"]/g;
  
  rewritten = rewritten.replace(importRegex, (match, imports, moduleName) => {
    const cleanImports = imports.trim();
    
    if (cleanImports.startsWith('{')) {
      return `const ${cleanImports} = __require('${moduleName}')`;
    }
    
    const parts = cleanImports.split(/\s*,\s*/);
    const statements: string[] = [];
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('{')) {
        statements.push(`const ${trimmed} = __require('${moduleName}')`);
      } else {
        statements.push(`const ${trimmed} = __require('${moduleName}').default || __require('${moduleName}')`);
      }
    }
    
    return statements.join(';\n');
  });

  const exportDefaultSchemaRegex = /export\s+default\s+(\w+)/g;
  rewritten = rewritten.replace(exportDefaultSchemaRegex, '__exports.default = $1');

  const exportConstRegex = /export\s+const\s+(\w+)\s*=/g;
  rewritten = rewritten.replace(exportConstRegex, '__exports.$1 = ');

  const exportNamedRegex = /export\s+\{\s*([^}]+)\s*\}/g;
  rewritten = rewritten.replace(exportNamedRegex, (match, names) => {
    const exports = names.split(',').map((n: string) => {
      const [name, alias] = n.trim().split(/\s+as\s+/);
      return `__exports.${alias || name} = ${name}`;
    });
    return exports.join(';\n');
  });

  return rewritten;
}

export async function compileAndExecute(
  code: string,
  modules: PlaygroundModules,
  filename = 'schema.ts'
): Promise<ExecutionResult> {
  const compilationResult = await compileTypeScript(code, filename);
  
  if (!compilationResult.success) {
    return {
      success: false,
      error: `Compilation error: ${compilationResult.error}`,
    };
  }

  return executeAndBuildSchema(compilationResult.code!, modules);
}
