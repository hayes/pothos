'use client';

// Runtime side of "import any npm package": for every bare import the
// user writes that we don't ship locally (Pothos packages, graphql,
// zod), we fetch the matching ESM build from esm.sh and feed it into
// the execution engine's module map. Pairs with `setup-monaco-ata.ts`
// which handles the type-acquisition side.
//
// esm.sh is a proxy CDN that serves esbuild-bundled, browser-friendly
// ES modules and resolves nested dependencies on its own. For the
// playground that means a single `import('https://esm.sh/lodash')`
// returns a working ES module namespace without us having to walk
// node_modules or run a bundler at runtime.

const CDN_BASE = 'https://esm.sh';

const cache = new Map<string, Promise<unknown>>();

/**
 * `import()` against an arbitrary URL. Wrapped in `new Function` so
 * the bundler can't statically analyze the URL and try to resolve it
 * at build time — Next/Turbopack would otherwise either inline the
 * fetch or error.
 */
const dynamicImport = new Function('url', 'return import(url);') as (
  url: string,
) => Promise<unknown>;

interface AmdDefine {
  amd?: unknown;
}

/**
 * esm.sh ships some packages (e.g. lodash) as UMD wrappers that detect
 * an AMD environment via `typeof define === 'function' && define.amd`.
 * Monaco brings its own AMD loader along (it sets `window.define` with
 * `.amd` truthy) — so when our dynamic import evaluates a UMD module
 * the wrapper hands the module body off to Monaco's loader instead of
 * running the CommonJS path. The result is a namespace where `default`
 * is an empty object and every named export is `undefined`.
 *
 * Suppress `define.amd` for the lifetime of the import so the module
 * falls through to its CJS branch. We restore the flag in `finally`,
 * keeping the window brief so Monaco's own concurrent loads (rare; it
 * only re-enters its loader for late-bound language services) aren't
 * affected.
 */
async function importWithoutAmd(url: string): Promise<unknown> {
  const w = globalThis as unknown as { define?: AmdDefine };
  const define = w.define;
  const savedAmd = define?.amd;
  if (define && savedAmd !== undefined) {
    define.amd = undefined;
  }
  try {
    return await dynamicImport(url);
  } finally {
    if (define && savedAmd !== undefined) {
      define.amd = savedAmd;
    }
  }
}

export function fetchCdnModule(name: string): Promise<unknown> {
  let pending = cache.get(name);
  if (!pending) {
    pending = importWithoutAmd(`${CDN_BASE}/${name}`).catch((err) => {
      // Drop the cached promise so a transient failure can be retried
      // by simply re-running the schema.
      cache.delete(name);
      throw err;
    });
    cache.set(name, pending);
  }
  return pending;
}

export function clearCdnCache(): void {
  cache.clear();
}

const RELATIVE = /^\.\.?\//;

/**
 * Pull every bare module specifier out of a JS source. We deliberately
 * don't try to be a real parser — esbuild's transform output is
 * normalized enough that a regex catches the cases we care about
 * (post-compilation, no JSX, no TS-only forms). Side-effect imports
 * (`import 'foo'`) and re-exports (`export { x } from 'foo'`) are both
 * picked up so a `getPluginModules`-style scan on the raw source
 * misses nothing.
 */
export function extractBareImports(code: string): Set<string> {
  const out = new Set<string>();
  const patterns: RegExp[] = [
    /import\s+[\s\S]*?\s+from\s*['"]([^'"]+)['"]/g,
    /import\s*['"]([^'"]+)['"]/g,
    /export\s+\*\s+from\s*['"]([^'"]+)['"]/g,
    /export\s*\{[^}]*\}\s*from\s*['"]([^'"]+)['"]/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null = re.exec(code);
    while (match !== null) {
      const name = match[1];
      if (!RELATIVE.test(name)) {
        out.add(name);
      }
      match = re.exec(code);
    }
  }
  return out;
}
