import type { Monaco } from '@monaco-editor/react';
import { pothosTypeDefinitions } from './pothos-types';

let initialized = false;

export function setupMonacoForPothos(monaco: Monaco): void {
  if (initialized) {
    return;
  }
  initialized = true;

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    lib: ['esnext'],
    allowSyntheticDefaultImports: true,
    typeRoots: ['node_modules/@types'],
  });

  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  });

  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

  // Load all type definitions
  for (const typeDef of pothosTypeDefinitions) {
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

  console.log(`[Monaco] Loaded ${pothosTypeDefinitions.length} Pothos type definitions`);
}

export function resetMonacoSetup(): void {
  initialized = false;
}
