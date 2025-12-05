'use client';

import { useState } from 'react';
import type { PlaygroundFile } from './types';

interface CodeViewerProps {
  files: PlaygroundFile[];
  activeFile?: string;
  onFileChange?: (filename: string) => void;
}

export function CodeViewer({ files, activeFile, onFileChange }: CodeViewerProps) {
  const [currentFile, setCurrentFile] = useState(activeFile || files[0]?.filename);
  const file = files.find((f) => f.filename === currentFile) || files[0];

  const handleFileChange = (filename: string) => {
    setCurrentFile(filename);
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
              onClick={() => handleFileChange(f.filename)}
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
      <div className="flex-1 overflow-auto bg-fd-card">
        <pre className="p-4 text-sm leading-relaxed">
          <code>{file?.content}</code>
        </pre>
      </div>
    </div>
  );
}
