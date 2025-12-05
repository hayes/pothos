'use client';

import Editor, { useMonaco } from '@monaco-editor/react';
import { useCallback, useEffect, useState, type FC } from 'react';
import type { PlaygroundFile } from './types';

interface MultiFileEditorProps {
  files: PlaygroundFile[];
  activeFile: string;
  onActiveFileChange: (filename: string) => void;
  onFileChange: (filename: string, content: string) => void;
  onAddFile: () => void;
  onDeleteFile: (filename: string) => void;
  onRenameFile: (oldName: string, newName: string) => void;
}

function useTheme() {
  const [theme, setTheme] = useState<'vs-dark' | 'light'>('vs-dark');

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'vs-dark' : 'light');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

const PlusIcon: FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseIcon: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const MultiFileEditor: FC<MultiFileEditorProps> = ({
  files,
  activeFile,
  onActiveFileChange,
  onFileChange,
  onAddFile,
  onDeleteFile,
}) => {
  const theme = useTheme();
  const monaco = useMonaco();
  const [typesLoaded, setTypesLoaded] = useState(false);
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (monaco && !typesLoaded) {
      import('../../lib/playground/setup-monaco').then(({ setupMonacoForPothos }) => {
        setupMonacoForPothos(monaco);
        setTypesLoaded(true);
      });
    }
  }, [monaco, typesLoaded]);

  const currentFile = files.find((f) => f.filename === activeFile) || files[0];

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && currentFile) {
        onFileChange(currentFile.filename, value);
      }
    },
    [currentFile, onFileChange]
  );

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.graphql') || filename.endsWith('.gql')) return 'graphql';
    if (filename.endsWith('.json')) return 'json';
    return 'typescript';
  };

  const canDeleteFile = files.length > 1;
  const isMainFile = (filename: string) => filename === 'schema.ts';

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b border-fd-border bg-fd-muted/30 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-1">
          {files.map((file) => (
            <div
              key={file.filename}
              className={`group flex shrink-0 items-center gap-1 rounded-t-md border-b-2 px-3 py-1.5 text-xs transition-colors ${
                file.filename === activeFile
                  ? 'border-fd-primary bg-fd-background text-fd-foreground'
                  : 'border-transparent text-fd-muted-foreground hover:bg-fd-muted/50 hover:text-fd-foreground'
              }`}
            >
              {editingTab === file.filename ? (
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => setEditingTab(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setEditingTab(null);
                    } else if (e.key === 'Escape') {
                      setEditingTab(null);
                    }
                  }}
                  className="w-24 rounded border border-fd-border bg-fd-background px-1 text-xs outline-none focus:border-fd-primary"
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onActiveFileChange(file.filename)}
                  className="font-medium"
                >
                  {file.filename}
                </button>
              )}
              {canDeleteFile && !isMainFile(file.filename) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteFile(file.filename);
                  }}
                  className="ml-1 rounded p-0.5 opacity-0 transition-opacity hover:bg-fd-muted group-hover:opacity-100"
                  title="Close file"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onAddFile}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground"
          title="Add new file"
        >
          <PlusIcon />
        </button>
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1">
        {currentFile && (
          <Editor
            height="100%"
            language={getLanguage(currentFile.filename)}
            path={`file:///playground/${currentFile.filename}`}
            value={currentFile.content}
            theme={theme}
            onChange={handleChange}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              folding: true,
              renderLineHighlight: 'line',
              scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
              padding: { top: 16, bottom: 16 },
              quickSuggestions: true,
              suggestOnTriggerCharacters: true,
            }}
          />
        )}
      </div>
    </div>
  );
};
