'use client';

import Editor, { useMonaco } from '@monaco-editor/react';
import { useEffect, useRef, useState } from 'react';
import { useEditorTheme } from '@/hooks/playground/useEditorTheme';
import type { PlaygroundFile } from '../types';
import { setFormatHandler } from './format-handler';

interface Props {
  filename: string;
  source: string;
  /** All files in the workspace — used to register cross-file types in Monaco. */
  allFiles?: PlaygroundFile[];
  /** When true, the editor renders read-only — used for generated files. */
  readOnly?: boolean;
  onChange: (value: string) => void;
}

/** Pick a Monaco language ID from a filename. Defaults to typescript so
 *  schema modules, plugin files, etc. all get the full TS service. */
function languageForFilename(filename: string): string {
  if (filename.endsWith('.json')) {
    return 'json';
  }
  if (filename.endsWith('.sql')) {
    return 'sql';
  }
  if (filename.endsWith('.graphql') || filename.endsWith('.gql')) {
    return 'graphql';
  }
  return 'typescript';
}

/**
 * Monaco TypeScript editor wired to the Pothos type bundle.
 * Loads Pothos types lazily, registers all open files for cross-file
 * checking, and pushes plugin types as the source changes.
 */
export function SourceEditor({ filename, source, allFiles, readOnly = false, onChange }: Props) {
  const monaco = useMonaco();
  const [typesLoaded, setTypesLoaded] = useState(false);
  const editorRef = useRef<
    Parameters<NonNullable<Parameters<typeof Editor>[0]['onMount']>>[0] | null
  >(null);
  const filesKeyRef = useRef('');
  const { theme: editorTheme, beforeMount: registerThemes } = useEditorTheme();

  useEffect(() => {
    if (!monaco || typesLoaded) {
      return;
    }
    import('@/lib/playground/setup-monaco').then(({ setupMonacoForPothos }) => {
      setupMonacoForPothos(monaco);
      setTypesLoaded(true);
    });
  }, [monaco, typesLoaded]);

  useEffect(() => {
    if (!monaco || !typesLoaded || !allFiles || allFiles.length <= 1) {
      return;
    }
    const key = allFiles.map((f) => `${f.filename}:${f.content.length}`).join(',');
    if (key === filesKeyRef.current) {
      return;
    }
    filesKeyRef.current = key;
    import('@/lib/playground/setup-monaco').then(({ registerPlaygroundFiles }) => {
      registerPlaygroundFiles(allFiles);
    });
  }, [monaco, typesLoaded, allFiles]);

  useEffect(() => {
    if (!monaco || !typesLoaded || !source) {
      return;
    }
    // Scan EVERY file in the example for imports, not just the active
    // one. Otherwise switching to a file that doesn't import a plugin
    // would unload that plugin's types — even when sibling files in
    // the same example still need them.
    const combinedSource = allFiles?.length ? allFiles.map((f) => f.content).join('\n') : source;
    import('@/lib/playground/setup-monaco').then(({ loadPluginTypes }) => {
      loadPluginTypes(combinedSource);
    });
    // Auto-type-acquisition for arbitrary npm packages (zod, lodash,
    // etc.). Lazy-loaded; failures are non-fatal. Runs in parallel with
    // `loadPluginTypes` because they cover non-overlapping import
    // sources (Pothos plugins are local-bundled; ATA skips those paths).
    import('@/lib/playground/setup-monaco-ata')
      .then(({ feedATA }) => feedATA(monaco, combinedSource))
      .catch((err) => {
        // ATA failures are non-fatal — the editor still works without
        // external types. Log so the failure is visible in devtools but
        // don't surface to the user (their code isn't what's wrong).
        import('@/lib/playground/logger').then(({ monacoLogger }) => {
          monacoLogger.warn('ATA load failed:', err);
        });
      });
  }, [monaco, typesLoaded, source, allFiles]);

  // Clear the format-handler registry when this editor unmounts so a
  // stale handler doesn't fire after the user switches to the SDL pane.
  useEffect(() => {
    return () => setFormatHandler(null);
  }, []);

  const expectedPath = `file:///playground/${filename}`;

  return (
    <Editor
      height="100%"
      language={languageForFilename(filename)}
      path={expectedPath}
      value={source}
      theme={editorTheme}
      onChange={(value) => {
        if (value === undefined) return;
        // Drop change events whose underlying model isn't the active
        // file. `@monaco-editor/react` can fire `onChange` for the OLD
        // model during a path swap (when both `path` and `value`
        // change in the same render). Without this guard, the
        // generated file's content gets written back into the file
        // we just switched TO.
        const modelPath = editorRef.current?.getModel()?.uri.toString();
        if (modelPath && modelPath !== expectedPath) return;
        onChange(value);
      }}
      beforeMount={registerThemes}
      onMount={(editor) => {
        editorRef.current = editor;
        if (!readOnly) {
          setFormatHandler(() => {
            editor.getAction('editor.action.formatDocument')?.run();
          });
        }
      }}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        renderLineHighlight: 'line',
        padding: { top: 16, bottom: 16 },
        quickSuggestions: !readOnly,
        suggestOnTriggerCharacters: !readOnly,
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  );
}
