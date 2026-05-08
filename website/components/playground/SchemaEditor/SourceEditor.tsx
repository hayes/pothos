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
  onChange: (value: string) => void;
}

/**
 * Monaco TypeScript editor wired to the Pothos type bundle.
 * Loads Pothos types lazily, registers all open files for cross-file
 * checking, and pushes plugin types as the source changes.
 */
export function SourceEditor({ filename, source, allFiles, onChange }: Props) {
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
    import('@/lib/playground/setup-monaco').then(({ loadPluginTypes }) => {
      loadPluginTypes(source);
    });
    // Auto-type-acquisition for arbitrary npm packages (zod, lodash,
    // etc.). Lazy-loaded; failures are non-fatal. Runs in parallel with
    // `loadPluginTypes` because they cover non-overlapping import
    // sources (Pothos plugins are local-bundled; ATA skips those paths).
    import('@/lib/playground/setup-monaco-ata')
      .then(({ feedATA }) => feedATA(monaco, source))
      .catch((err) => {
        // ATA failures are non-fatal — the editor still works without
        // external types. Log so the failure is visible in devtools but
        // don't surface to the user (their code isn't what's wrong).
        import('@/lib/playground/logger').then(({ monacoLogger }) => {
          monacoLogger.warn('ATA load failed:', err);
        });
      });
  }, [monaco, typesLoaded, source]);

  // Clear the format-handler registry when this editor unmounts so a
  // stale handler doesn't fire after the user switches to the SDL pane.
  useEffect(() => {
    return () => setFormatHandler(null);
  }, []);

  return (
    <Editor
      height="100%"
      language="typescript"
      path={`file:///playground/${filename}`}
      value={source}
      theme={editorTheme}
      onChange={(value) => value !== undefined && onChange(value)}
      beforeMount={registerThemes}
      onMount={(editor) => {
        editorRef.current = editor;
        setFormatHandler(() => {
          editor.getAction('editor.action.formatDocument')?.run();
        });
      }}
      options={{
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
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        scrollbar: {
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
      }}
    />
  );
}
