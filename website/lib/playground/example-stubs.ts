/**
 * Registry of "stub" modules an example can provide for synthetic
 * package specifiers — names user code imports as if they were npm
 * packages but which aren't loadable from the playground's CDN. The
 * stub registration ships with the example (or with a plugin's
 * playground entry); the execution engine looks up each bare import
 * against the registry before falling back to esm.sh.
 *
 * Examples register on import:
 *
 *   import { registerExampleStubs } from '@/lib/playground/example-stubs';
 *   import * as MyHelpers from './my-helpers';
 *   registerExampleStubs({ '@my-org/helpers': MyHelpers });
 *
 * Empty on this branch — populated by example-specific wiring.
 */

'use client';

let stubRegistry: Record<string, unknown> = {};

export function registerExampleStubs(stubs: Record<string, unknown>): void {
  stubRegistry = { ...stubRegistry, ...stubs };
}

const IMPORT_SPECIFIER_RE = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

/**
 * Return the subset of registered stubs whose specifier appears as an
 * import in `code`. Matched specifiers are added to `knownLocally` so
 * the execution engine injects the stub module instead of fetching
 * from esm.sh.
 */
export function getExampleStubModules(code: string): Record<string, unknown> {
  if (Object.keys(stubRegistry).length === 0) {
    return {};
  }
  const seen = new Set<string>();
  IMPORT_SPECIFIER_RE.lastIndex = 0;
  let match: RegExpExecArray | null = IMPORT_SPECIFIER_RE.exec(code);
  while (match !== null) {
    seen.add(match[1]);
    match = IMPORT_SPECIFIER_RE.exec(code);
  }
  const out: Record<string, unknown> = {};
  for (const [specifier, mod] of Object.entries(stubRegistry)) {
    if (seen.has(specifier)) {
      out[specifier] = mod;
    }
  }
  return out;
}
