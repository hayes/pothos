'use client';

import Editor, { type Monaco, useMonaco } from '@monaco-editor/react';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaygroundFile } from './types';

interface MonacoEditorProps {
  files: PlaygroundFile[];
  activeFile?: string;
  onFileChange?: (filename: string) => void;
  readOnly?: boolean;
  onContentChange?: (filename: string, content: string) => void;
}

const FILE_LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  graphql: 'graphql',
  gql: 'graphql',
  json: 'json',
};

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop() || '';
  return FILE_LANGUAGE_MAP[ext] || 'typescript';
}

export function MonacoEditor({
  files,
  activeFile,
  onFileChange,
  readOnly = true,
  onContentChange,
}: MonacoEditorProps) {
  const { resolvedTheme } = useTheme();
  const monaco = useMonaco();
  const editorRef =
    useRef<Parameters<NonNullable<Parameters<typeof Editor>[0]['onMount']>>[0]>(null);
  const [typesLoaded, setTypesLoaded] = useState(false);
  const currentFile = activeFile || files[0]?.filename;
  const file = files.find((f) => f.filename === currentFile) || files[0];

  useEffect(() => {
    if (monaco && !typesLoaded) {
      import('../../lib/playground/setup-monaco').then(({ setupMonacoForPothos }) => {
        setupMonacoForPothos(monaco);
        setTypesLoaded(true);
      });
    }
  }, [monaco, typesLoaded]);

  const handleEditorMount = useCallback(
    (editor: typeof editorRef.current, monacoInstance: Monaco) => {
      editorRef.current = editor;
      import('../../lib/playground/setup-monaco').then(({ setupMonacoForPothos }) => {
        setupMonacoForPothos(monacoInstance);
        setTypesLoaded(true);
      });
    },
    [],
  );

  const getModelUri = useCallback(
    (filename: string) => {
      if (!monaco) return undefined;
      return monaco.Uri.parse(`file:///playground/${filename}`);
    },
    [monaco],
  );

  const handleFileTabClick = (filename: string) => {
    onFileChange?.(filename);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {files.length > 1 && (
        <div className="flex border-b border-fd-border bg-fd-muted/50">
          {files.map((f) => (
            <button
              key={f.filename}
              type="button"
              onClick={() => handleFileTabClick(f.filename)}
              className={`px-3 py-2 text-sm transition-colors ${
                f.filename === currentFile
                  ? 'border-b-2 border-fd-primary bg-fd-background text-fd-foreground'
                  : 'text-fd-muted-foreground hover:text-fd-foreground'
              }`}
            >
              {f.filename}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language={getLanguage(file?.filename || 'schema.ts')}
          path={getModelUri(file?.filename || 'schema.ts')?.toString()}
          value={file?.content || ''}
          theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
          onMount={handleEditorMount}
          onChange={(value) => {
            if (value !== undefined && file) {
              onContentChange?.(file.filename, value);
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
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            padding: { top: 12, bottom: 12 },
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
          }}
        />
      </div>
    </div>
  );
}
