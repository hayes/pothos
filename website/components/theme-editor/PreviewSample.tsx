'use client';

import Editor, { type Monaco } from '@monaco-editor/react';
import type { Sample } from './samples';

interface Props {
  sample: Sample;
  themeName: string;
  /** Optional — first preview attaches a beforeMount to capture Monaco
   *  for the parent so the parent can redefine the theme on input. */
  beforeMount?: (monaco: Monaco) => void;
}

export function PreviewSample({ sample, themeName, beforeMount }: Props) {
  const lines = sample.code.split('\n').length;
  const height = Math.min(540, Math.max(140, lines * 19 + 24));
  return (
    <section className="grid grid-rows-[auto_1fr] min-h-0 border border-bm-line rounded overflow-hidden">
      <header className="flex items-center px-4 h-8 border-b border-bm-line bg-bm-bg">
        <span className="font-mono text-[12px] text-bm-ink">{sample.filename}</span>
        <div className="flex-1" />
        <span className="text-[10px] uppercase tracking-[0.04em] text-bm-ink-muted">
          {sample.language}
        </span>
      </header>
      <div style={{ height }}>
        <Editor
          height="100%"
          language={sample.language}
          value={sample.code}
          theme={themeName}
          beforeMount={beforeMount}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'none',
            scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
    </section>
  );
}
