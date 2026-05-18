'use client';

import type { PlaygroundFile } from '../types';
import { SdlPane } from './SdlPane';
import { SourceEditor } from './SourceEditor';

interface Props {
  files: PlaygroundFile[];
  activeIndex: number;
  /** When true, the active view is the read-only generated SDL. */
  sdlActive: boolean;
  schemaSDL: string | null;
  onChange: (index: number, content: string) => void;
}

export function SchemaEditor({ files, activeIndex, sdlActive, schemaSDL, onChange }: Props) {
  const activeFile = files[activeIndex];
  const lineCount = activeFile?.content.split('\n').length ?? 0;
  const generated = activeFile?.generated === true;
  const language = languageLabelForFilename(activeFile?.filename ?? '');
  const meta = sdlActive
    ? 'Generated SDL · read-only'
    : generated
      ? `${language} · generated · read-only`
      : `${language} · ${lineCount} line${lineCount === 1 ? '' : 's'}`;
  const headerName = sdlActive ? 'schema.graphql' : (activeFile?.filename ?? '');

  return (
    <section className="grid grid-rows-[auto_1fr] min-w-0 min-h-0 border-r border-bm-line bg-bm-editor-bg">
      <header className="flex items-center px-6 h-11 border-b border-bm-line bg-bm-bg">
        <span
          className={`font-mono text-[13px] tracking-[-0.01em] text-bm-ink ${
            sdlActive || generated ? 'italic' : ''
          }`}
        >
          {headerName}
        </span>
        <div className="flex-1" />
        <span className="text-[11px] uppercase tracking-[0.04em] text-bm-ink-muted">{meta}</span>
      </header>
      <div className="min-h-0">
        {sdlActive ? (
          <SdlPane schemaSDL={schemaSDL} />
        ) : activeFile ? (
          <SourceEditor
            filename={activeFile.filename}
            source={activeFile.content}
            allFiles={files}
            readOnly={generated}
            onChange={(value) => onChange(activeIndex, value)}
          />
        ) : null}
      </div>
    </section>
  );
}

function languageLabelForFilename(filename: string): string {
  if (filename.endsWith('.json')) {
    return 'JSON';
  }
  if (filename.endsWith('.sql')) {
    return 'SQL';
  }
  if (filename.endsWith('.graphql') || filename.endsWith('.gql')) {
    return 'GraphQL';
  }
  return 'TypeScript';
}
