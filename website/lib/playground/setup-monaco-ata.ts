'use client';

import type { Monaco } from '@monaco-editor/react';

// Auto-Type Acquisition: when the user imports an arbitrary npm
// package (zod, lodash, …), parse their code, fetch the package's
// `.d.ts` files from jsdelivr, and feed them into Monaco so types,
// hovers, and completions all work the same way they would in a real
// TypeScript project. We skip paths that we already provide locally
// (Pothos packages and graphql) because those have authoritative
// versions wired through `setup-monaco` / `bundle-types`.
//
// The runtime side is separate: dependencies still execute via the
// `dependencies-bundle` map. Adding new runtime modules at run time is
// out of scope here — this module exists just to make Monaco stop
// reporting "Cannot find module 'X'" for anything that isn't bundled.

let monacoRef: Monaco | null = null;
let runATAPromise: Promise<((source: string) => Promise<void>) | null> | null = null;
// Every type file ATA has ever delivered, keyed by its canonical
// `file://node_modules/...` path. Stored in our own map (rather than
// piggy-backing on Monaco's `getExtraLibs()`) so we can replay the
// content under a versioned alias after the user adds `@version` to
// an existing import.
const ataLibs = new Map<string, string>();
// Pending updates that haven't been flushed to Monaco yet. ATA fires
// `receivedFile` once per `.d.ts` (hundreds of times for a single
// package) and each `addExtraLib` triggers a fresh TS validation
// cycle, which produces visible jitter. We collect everything and
// commit in a single `setExtraLibs` call per microtask.
const pendingLibUpdates = new Map<string, string>();
let flushScheduled = false;
// Tracks `<pkg>` → set of `<version>` strings so when ATA delivers a
// `.d.ts` for `<pkg>` we can also register it under the user's
// versioned specifier (e.g. `lodash@4.17.21`).
const versionedAliases = new Map<string, Set<string>>();

const SKIP_PATH = /^\/node_modules\/(?:@pothos\/|@prisma-next\/|graphql(?:\/|$))/;

// Imports we never want ATA to ask jsdelivr about: @pothos/* and
// @prisma-next/* are bundled into Monaco directly via setup-monaco
// (prisma-next is not on npm yet), and `readline` is a Node builtin
// for which `@types/readline` doesn't exist on the registry. ATA's
// fetch still hits jsdelivr per import even when receivedFile filters
// the result, so we strip them at the source-rewrite stage.
const ATA_SKIP_BARE = /^(?:@pothos\/[^/'"]+|@prisma-next\/[^/'"]+|readline)/;

function stripBundledImportsForAta(source: string): string {
  return source.replace(
    /^[ \t]*import\s+(?:[^'"]*?\s+from\s+)?(['"])([^'"]+)\1[ \t]*;?[ \t]*$/gm,
    (match, _q, spec: string) => (ATA_SKIP_BARE.test(spec) ? '' : match),
  );
}

/**
 * Rewrite `import x from 'pkg@version'` (or scoped equivalents) so ATA
 * can recognize the package name and fetch matching types from
 * jsdelivr. ATA accepts a `// types: <version>` trailing comment as a
 * version pin — exactly the channel we need.
 *
 * We also collect the pairs so the receivedFile callback can register
 * an alias under the original versioned path, otherwise Monaco's TS
 * service would still see "Cannot find module 'pkg@version'" against
 * the user's untouched source in the editor.
 */
function rewriteVersionedImportsForAta(source: string): string {
  // Consume the trailing `;` (if any) so the `// types: …` comment
  // doesn't capture it — ATA reads the comment to determine the
  // version and a stray semicolon would make `version = "4.17.21;"`,
  // which jsdelivr rejects. Horizontal whitespace only (`[ \t]*`) so
  // we don't eat the newline that ends the import statement and turn
  // the rest of the file into a `// types: …` comment.
  return source.replace(
    /from\s+(['"])([^'"]+)\1[ \t]*(;?)/g,
    (match, quote: string, spec: string, semi: string) => {
      const versionAt = spec.indexOf('@', spec.startsWith('@') ? 1 : 0);
      if (versionAt === -1) {
        return match;
      }
      const slashAfter = spec.indexOf('/', versionAt);
      const versionEnd = slashAfter === -1 ? spec.length : slashAfter;
      const pkg = spec.slice(0, versionAt);
      const version = spec.slice(versionAt + 1, versionEnd);
      const subpath = spec.slice(versionEnd);
      if (!version) {
        return match;
      }

      const versions = versionedAliases.get(pkg) ?? new Set<string>();
      versions.add(version);
      versionedAliases.set(pkg, versions);

      return `from ${quote}${pkg}${subpath}${quote}${semi} // types: ${version}`;
    },
  );
}

async function buildATA(monaco: Monaco): Promise<((source: string) => Promise<void>) | null> {
  // Both ATA and TypeScript are heavy (~MBs), so they're imported only
  // after the schema editor has mounted and the user has actually
  // started editing.
  const [ataMod, tsMod] = await Promise.all([import('@typescript/ata'), import('typescript')]);

  // typescript's namespace import in some bundlers exposes the API on
  // `.default`; ATA wants the namespace itself. Pick whichever has the
  // canonical surface.
  const ts = ((tsMod as unknown as { default?: typeof tsMod }).default ?? tsMod) as typeof tsMod;

  const queueLib = (code: string, path: string) => {
    const filePath = `file://${path}`;
    ataLibs.set(filePath, code);
    pendingLibUpdates.set(filePath, code);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => flushPendingLibs(monaco));
    }
  };

  return ataMod.setupTypeAcquisition({
    projectName: 'pothos-playground',
    typescript: ts,
    delegate: {
      receivedFile(code, path) {
        if (SKIP_PATH.test(path)) {
          return;
        }
        queueLib(code, path);
        registerVersionedAliasesFor(path, code, queueLib);
      },
    },
  });
}

/**
 * One `setExtraLibs` call per microtask. Reads Monaco's current libs,
 * applies every queued update, and writes the merged set back. Pothos
 * plugin libs (added through `setup-monaco`) survive because we read
 * them via `getExtraLibs()` before re-emitting.
 */
function flushPendingLibs(monaco: Monaco): void {
  flushScheduled = false;
  if (pendingLibUpdates.size === 0) {
    return;
  }
  const tsd = monaco.languages.typescript.typescriptDefaults;
  const current = tsd.getExtraLibs();
  const merged: Record<string, string> = {};
  for (const [filePath, { content }] of Object.entries(current)) {
    merged[filePath] = content;
  }
  for (const [filePath, content] of pendingLibUpdates) {
    merged[filePath] = content;
  }
  pendingLibUpdates.clear();
  tsd.setExtraLibs(Object.entries(merged).map(([filePath, content]) => ({ filePath, content })));
}

/**
 * Compute and register the versioned-alias paths for one ATA-delivered
 * file. Called both at delivery time and during retroactive sync (when
 * the user adds a `pkg@version` import to a package whose types ATA
 * already fetched).
 */
function registerVersionedAliasesFor(
  path: string,
  code: string,
  queueLib: (code: string, path: string) => void,
): void {
  // ATA delivers types under either `/node_modules/<pkg>/…` (packages
  // with bundled types) or `/node_modules/@types/<pkg>/…`
  // (DefinitelyTyped). Match both shapes; for the @types case, strip
  // the prefix so it aligns with the user's bare specifier.
  const m =
    path.match(/^\/node_modules\/(@types\/[^/]+)(\/.*|$)/) ??
    path.match(/^\/node_modules\/((?:@[^/]+\/)?[^/]+)(\/.*|$)/);
  if (!m) {
    return;
  }
  const pkgInPath = m[1];
  const rest = m[2];
  const userPkg = pkgInPath.startsWith('@types/') ? pkgInPath.slice('@types/'.length) : pkgInPath;
  const versions = versionedAliases.get(userPkg);
  if (!versions) {
    return;
  }
  for (const version of versions) {
    queueLib(code, `/node_modules/${pkgInPath}@${version}${rest}`);
  }
}

/**
 * Walk every type file ATA has ever delivered and ensure it's
 * registered under each of the current `versionedAliases` paths. Lets
 * the user add `@version` to an import after the package has already
 * been fetched without triggering a refetch.
 */
function syncAliasesAcrossSeenFiles(monaco: Monaco): void {
  const queueLib = (code: string, filePath: string) => {
    const fp = `file://${filePath}`;
    ataLibs.set(fp, code);
    pendingLibUpdates.set(fp, code);
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(() => flushPendingLibs(monaco));
    }
  };
  // Walk every ATA-delivered file by its `file://` key. Strip the
  // scheme so registerVersionedAliasesFor's regex (which expects
  // `/node_modules/…`) keeps matching.
  for (const [filePath, code] of [...ataLibs]) {
    const path = filePath.startsWith('file://') ? filePath.slice('file://'.length) : filePath;
    registerVersionedAliasesFor(path, code, queueLib);
  }
}

/**
 * Feed user code into ATA. Idempotent — first call lazy-initializes,
 * later calls reuse the same instance. Failures (network, parse) are
 * non-fatal and silently ignored; users still get the local bundled
 * types for everything we ship locally.
 */
export async function feedATA(monaco: Monaco, source: string): Promise<void> {
  if (!source.trim()) {
    return;
  }
  monacoRef = monaco;
  if (!runATAPromise) {
    runATAPromise = buildATA(monaco).catch(() => null);
  }
  const run = await runATAPromise;
  if (!run) {
    return;
  }
  // Strip imports for packages we provide locally so ATA doesn't fan
  // out failed jsdelivr fetches for them on every keystroke; then
  // rewrite versioned specifiers (ATA doesn't recognize `pkg@version`
  // natively — it'd treat the whole string as a package name and emit
  // a malformed jsdelivr URL).
  const filtered = stripBundledImportsForAta(source);
  const rewritten = rewriteVersionedImportsForAta(filtered);
  // Replay aliasing against already-seen files in case the user just
  // added `@version` to an import whose package ATA had previously
  // fetched (without ATA re-delivering it).
  syncAliasesAcrossSeenFiles(monaco);
  try {
    await run(rewritten);
  } catch {
    // Non-fatal — ATA logs via its own delegate (we haven't wired one)
    // and a failed type fetch shouldn't break the editor.
  }
}

/**
 * Drop every type definition ATA has fetched. Useful if we ever need
 * to reset the editor environment (e.g. resetting to defaults).
 */
export function clearATA(): void {
  if (monacoRef) {
    const tsd = monacoRef.languages.typescript.typescriptDefaults;
    const current = tsd.getExtraLibs();
    const remaining = Object.entries(current)
      .filter(([fp]) => !ataLibs.has(fp))
      .map(([filePath, { content }]) => ({ filePath, content }));
    tsd.setExtraLibs(remaining);
  }
  ataLibs.clear();
  pendingLibUpdates.clear();
  flushScheduled = false;
  // `monacoRef` is still usable for the next feed, but we tear down the
  // ATA instance so the next call rebuilds with a clean slate.
  runATAPromise = null;
  monacoRef = null;
}
