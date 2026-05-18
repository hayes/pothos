import type { Monaco } from '@monaco-editor/react';
import { monacoLogger } from './logger';
import { coreTypeDefinitions, getAllPluginNames, getPluginTypeDefinitions } from './pothos-types';

interface MonacoDisposable {
  dispose(): void;
}

let initialized = false;
let monaco: Monaco | null = null;
// Per-plugin disposables returned by `addExtraLib`. We track them so
// removing a plugin import re-runs `loadPluginTypes` with that plugin
// absent, and we can call `.dispose()` on every extra-lib it added —
// otherwise its global type augmentations stay stuck in Monaco and the
// user gets stale "missing required field" errors after switching
// examples (e.g. scope-auth → validation).
const pluginDisposables = new Map<string, MonacoDisposable[]>();

// Cache getAllPluginNames result (static list)
let cachedPluginNames: string[] | null = null;

// Debounce timer for plugin loading
let loadPluginTypesTimer: ReturnType<typeof setTimeout> | null = null;

// Monaco's TypeScript worker rejects in-flight validation/diagnostic
// requests with `{ msg: 'operation is manually canceled', type: 'cancelation' }`
// whenever extra-libs change mid-cycle (which happens constantly while
// ATA is feeding `.d.ts` files in). The promise sites are inside
// monaco's worker plumbing, so we can't `.catch()` them at the source —
// instead install a one-shot window listener that swallows that exact
// shape. Anything else (real Errors, unrelated rejections) falls
// through unchanged.
let cancellationFilterInstalled = false;
function installMonacoCancellationFilter(): void {
  if (cancellationFilterInstalled || typeof window === 'undefined') {
    return;
  }
  cancellationFilterInstalled = true;
  window.addEventListener('unhandledrejection', (event) => {
    const r = event.reason as { msg?: unknown; type?: unknown } | null;
    if (
      r &&
      typeof r === 'object' &&
      r.type === 'cancelation' &&
      r.msg === 'operation is manually canceled'
    ) {
      event.preventDefault();
    }
  });
}

export function setupMonacoForPothos(monacoInstance: Monaco): void {
  if (initialized) {
    return;
  }
  initialized = true;
  monaco = monacoInstance;
  installMonacoCancellationFilter();

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    // Bundler (= TS's "bundler" resolution) honours `package.json#exports`
    // and locates `.d.mts` alongside `.mjs` automatically — needed for
    // vendored type packs whose subpath exports otherwise require
    // fan-out `declare module` wrappers per subpath.
    //
    // Monaco's bundled TypeScript types still only enumerate the legacy
    // resolution kinds (Classic / NodeJs). The hosted TS runtime
    // supports `Bundler` (value 100); cast through `unknown` to set it.
    moduleResolution:
      (monaco.languages.typescript.ModuleResolutionKind as unknown as Record<string, number>)
        .Bundler ?? 100,
    allowNonTsExtensions: true,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    lib: ['esnext', 'dom'],
    allowSyntheticDefaultImports: true,
    typeRoots: ['node_modules/@types'],
  });

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

  // Load core type definitions (GraphQL + @pothos/core)
  loadTypeDefinitions(coreTypeDefinitions);

  // Ambient declarations for `*.json` and `*.sql` data-file imports.
  // Monaco's TS worker treats files added via addExtraLib as TS source
  // regardless of extension, so `resolveJsonModule` doesn't kick in
  // even with a `.json` filename — TS would parse contract.json as TS
  // and complain "is not a module". The ambient wildcard handles
  // resolution at the import path; runtime types still come from the
  // sibling `.d.ts` sidecar (e.g. contract.d.ts → typed Contract).
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    [
      "declare module '*.json' {",
      '  const value: unknown;',
      '  export default value;',
      '}',
      "declare module '*.sql' {",
      '  const content: string;',
      '  export default content;',
      '}',
      '',
    ].join('\n'),
    'file:///playground/data-modules.d.ts',
  );

  monacoLogger.debug(`Loaded ${coreTypeDefinitions.length} core type definitions`);
}

function loadTypeDefinitions(
  typeDefs: Array<{ moduleName: string; content: string }>,
): MonacoDisposable[] {
  if (!monaco) {
    return [];
  }

  const disposables: MonacoDisposable[] = [];
  for (const typeDef of typeDefs) {
    const moduleParts = typeDef.moduleName.split('/');
    const hasGlobalDeclaration = typeDef.content.includes('declare global');

    // Determine if this is a package root (e.g., '@pothos/core', 'graphql')
    const isPackageRoot =
      typeDef.moduleName === 'graphql' ||
      (moduleParts.length === 2 && moduleParts[0] === '@pothos');

    let filePath: string;
    if (isPackageRoot) {
      filePath = `file:///node_modules/${typeDef.moduleName}/index.d.ts`;
    } else {
      filePath = `file:///node_modules/${typeDef.moduleName}.d.ts`;
    }

    // For files with declare global that have imports, we need to wrap them
    // in a module declaration so Monaco can process the imports correctly
    let content = typeDef.content;
    if (hasGlobalDeclaration && !content.startsWith('declare module')) {
      content = `declare module '${typeDef.moduleName}' {\n${content}\n}`;
    }

    disposables.push(monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filePath));
  }
  return disposables;
}

/**
 * Get cached plugin names list (avoids repeated calls to getAllPluginNames)
 */
function getCachedPluginNames(): string[] {
  if (!cachedPluginNames) {
    cachedPluginNames = getAllPluginNames();
  }
  return cachedPluginNames;
}

/**
 * Load plugin types dynamically based on imports in the code
 * Uses debouncing to avoid loading on every keystroke
 */
/**
 * Register playground files with Monaco for cross-file type checking
 * This allows imports between files to work in the editor
 */
export function registerPlaygroundFiles(files: Array<{ filename: string; content: string }>): void {
  if (!monaco) {
    return;
  }

  // Register each file as a model in Monaco's virtual file system.
  // Language ID drives which Monaco service parses the file: typescript
  // for .ts/.d.ts (the eager-model-sync path feeds these to the TS
  // worker), json/plaintext for data files (handled by their own
  // language services for editor highlighting). Data-file imports
  // resolve via the wildcard `*.json` / `*.sql` ambient declarations
  // registered in setupMonacoForPothos — adding them to the TS worker
  // here is counter-productive because TS would parse the JSON as TS
  // source and fail with "is not a module".
  for (const file of files) {
    const filePath = `file:///playground/${file.filename}`;
    const lang = file.filename.endsWith('.json')
      ? 'json'
      : file.filename.endsWith('.sql')
        ? 'plaintext'
        : 'typescript';

    // Check if model already exists
    const existingModel = monaco.editor.getModel(monaco.Uri.parse(filePath));

    if (existingModel) {
      // Only update if content has actually changed to avoid resetting cursor position
      if (existingModel.getValue() !== file.content) {
        existingModel.setValue(file.content);
      }
    } else {
      monaco.editor.createModel(file.content, lang, monaco.Uri.parse(filePath));
    }
  }
}

export function loadPluginTypes(code: string): void {
  if (!monaco) {
    return;
  }

  // Clear existing timer to debounce
  if (loadPluginTypesTimer) {
    clearTimeout(loadPluginTypesTimer);
  }

  // Debounce plugin loading to avoid excessive calls during typing
  loadPluginTypesTimer = setTimeout(() => {
    const pluginImports = extractPluginImports(code);
    const allPluginNames = getCachedPluginNames();

    // Unload plugins that are no longer imported. Each plugin's
    // `addExtraLib` calls returned a disposable; firing those removes
    // the plugin's global type augmentation (otherwise Pothos's
    // `RemoveNeverKeys<SchemaBuilderOptions<…>>` keeps demanding a
    // `scopeAuth` field after the user removes the import).
    for (const pluginName of Array.from(pluginDisposables.keys())) {
      if (!pluginImports.has(pluginName)) {
        const disposables = pluginDisposables.get(pluginName);
        if (disposables) {
          for (const d of disposables) {
            d.dispose();
          }
        }
        pluginDisposables.delete(pluginName);
        monacoLogger.debug(`Unloaded type definitions for ${pluginName}`);
      }
    }

    // Load newly imported plugins
    for (const pluginName of Array.from(pluginImports)) {
      if (!pluginDisposables.has(pluginName) && allPluginNames.includes(pluginName)) {
        const pluginTypes = getPluginTypeDefinitions(pluginName);
        const disposables = loadTypeDefinitions(pluginTypes);
        pluginDisposables.set(pluginName, disposables);
        monacoLogger.debug(`Loaded ${pluginTypes.length} type definitions for ${pluginName}`);
      }
    }
  }, 500); // 500ms debounce
}

function extractPluginImports(code: string): Set<string> {
  const imports = new Set<string>();
  // Match: import ... from '@pothos/plugin-...'
  const importRegex = /import\s+.*?\s+from\s+['"](@pothos\/plugin-[^'"]+)['"]/g;

  let match = importRegex.exec(code);
  while (match !== null) {
    imports.add(match[1]);
    match = importRegex.exec(code);
  }

  return imports;
}

export function resetMonacoSetup(): void {
  initialized = false;
  monaco = null;
  for (const disposables of pluginDisposables.values()) {
    for (const d of disposables) {
      d.dispose();
    }
  }
  pluginDisposables.clear();
  cachedPluginNames = null;

  // Clear any pending debounce timer
  if (loadPluginTypesTimer) {
    clearTimeout(loadPluginTypesTimer);
    loadPluginTypesTimer = null;
  }
}
