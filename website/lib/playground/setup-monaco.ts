import type { Monaco } from '@monaco-editor/react';
import { coreTypeDefinitions, getAllPluginNames, getPluginTypeDefinitions } from './pothos-types';

let initialized = false;
let monaco: Monaco | null = null;
const loadedPlugins = new Set<string>();

// Cache getAllPluginNames result (static list)
let cachedPluginNames: string[] | null = null;

// Debounce timer for plugin loading
let loadPluginTypesTimer: ReturnType<typeof setTimeout> | null = null;

export function setupMonacoForPothos(monacoInstance: Monaco): void {
  if (initialized) {
    return;
  }
  initialized = true;
  monaco = monacoInstance;

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
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

  console.log(`[Monaco] Loaded ${coreTypeDefinitions.length} core type definitions`);
}

function loadTypeDefinitions(typeDefs: Array<{ moduleName: string; content: string }>): void {
  if (!monaco) {
    return;
  }

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

    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, filePath);
  }
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

  // Register each file as a model in Monaco's virtual file system
  for (const file of files) {
    const filePath = `file:///playground/${file.filename}`;

    // Check if model already exists
    const existingModel = monaco.editor.getModel(monaco.Uri.parse(filePath));

    if (existingModel) {
      // Update existing model's value
      existingModel.setValue(file.content);
    } else {
      // Create new model
      monaco.editor.createModel(file.content, 'typescript', monaco.Uri.parse(filePath));
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
    // Extract plugin imports from code
    const pluginImports = extractPluginImports(code);
    const allPluginNames = getCachedPluginNames();

    // Load newly imported plugins
    for (const pluginName of Array.from(pluginImports)) {
      if (!loadedPlugins.has(pluginName) && allPluginNames.includes(pluginName)) {
        const pluginTypes = getPluginTypeDefinitions(pluginName);
        loadTypeDefinitions(pluginTypes);
        loadedPlugins.add(pluginName);
        console.log(`[Monaco] Loaded ${pluginTypes.length} type definitions for ${pluginName}`);
      }
    }
  }, 500); // 500ms debounce

  // Note: We don't unload unused plugins because Monaco doesn't provide
  // a clean way to remove specific type definitions. This is acceptable
  // because the extra types don't interfere with validation - they just
  // add optional capabilities that won't be used unless the plugin is imported.
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
  loadedPlugins.clear();
  cachedPluginNames = null;

  // Clear any pending debounce timer
  if (loadPluginTypesTimer) {
    clearTimeout(loadPluginTypesTimer);
    loadPluginTypesTimer = null;
  }
}
