'use client';

import Editor from '@monaco-editor/react';
import { useTheme } from 'next-themes';

interface SchemaViewerProps {
  schema: string;
}

export function SchemaViewer({ schema }: SchemaViewerProps) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex border-b border-fd-border bg-fd-muted/50 px-3 py-2">
        <span className="text-sm text-fd-muted-foreground">Generated Schema</span>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          language="graphql"
          value={schema}
          theme={resolvedTheme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            readOnly: true,
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
          }}
        />
      </div>
    </div>
  );
}
