'use client';

import type { PlaygroundFile } from '../types';
import { SdlPane } from './SdlPane';
import { SourceEditor } from './SourceEditor';

interface Props {
  files: PlaygroundFile[];
  showTabs?: boolean;
  onSelectFile: (index: number) => void;
  onSelectSdl: () => void;
  activeIndex: number;
  /** When true, the active view is the read-only generated SDL. */
  sdlActive: boolean;
  schemaSDL: string | null;
  onChange: (index: number, content: string) => void;
}

export function SchemaEditor({
  files,
  activeIndex,
  sdlActive,
  schemaSDL,
  onChange,
  showTabs = false,
  onSelectFile,
  onSelectSdl,
}: Props) {
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
      {showTabs ? (
        <div
          role="tablist"
          aria-label="Schema files"
          className="flex overflow-x-auto border-b border-bm-line bg-bm-bg"
        >
          {[...files.map((file) => file.filename), 'schema.graphql'].map((name, index) => {
            const selected =
              index === files.length ? sdlActive : !sdlActive && index === activeIndex;
            const select = (next: number) => {
              if (next === files.length) {
                onSelectSdl();
              } else {
                onSelectFile(next);
              }
            };
            return (
              <button
                key={index === files.length ? 'generated-sdl' : `file-${name}`}
                type="button"
                role="tab"
                id={`schema-file-tab-${index}`}
                aria-selected={selected}
                aria-controls="schema-file-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => select(index)}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                    return;
                  }
                  event.preventDefault();
                  const count = files.length + 1;
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? files.length
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + count) % count;
                  select(next);
                  document.getElementById(`schema-file-tab-${next}`)?.focus();
                }}
                className={`shrink-0 cursor-pointer px-4 h-11 border-b-2 font-mono text-[12px] ${selected ? 'border-bm-accent text-bm-ink bg-bm-editor-bg' : 'border-transparent text-bm-ink-muted hover:text-bm-ink'}`}
              >
                {name}
                {index === files.length && (
                  <span className="ml-2 font-sans text-[11px]">(generated)</span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <header className="flex items-center gap-2 px-3 md:px-6 h-11 border-b border-bm-line bg-bm-bg">
          <select
            aria-label="Source file"
            className="md:hidden min-w-0 flex-1 bg-bm-bg text-bm-ink font-mono text-[13px] focus-visible:outline focus-visible:outline-2"
            value={sdlActive ? 'sdl' : String(activeIndex)}
            onChange={(event) => {
              if (event.target.value === 'sdl') {
                onSelectSdl();
              } else {
                onSelectFile(Number(event.target.value));
              }
            }}
          >
            {files.map((file, index) => (
              <option key={file.filename} value={String(index)}>
                {file.filename}
              </option>
            ))}
            <option value="sdl">schema.graphql (generated SDL)</option>
          </select>
          <span
            className={`hidden md:block font-mono text-[13px] tracking-[-0.01em] text-bm-ink ${
              sdlActive || generated ? 'italic' : ''
            }`}
          >
            {headerName}
          </span>
          <div className="hidden md:block flex-1" />
          <span className="hidden md:block text-[11px] uppercase tracking-[0.04em] text-bm-ink-muted">
            {meta}
          </span>
        </header>
      )}
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: both conditional roles support aria-labelledby */}
      <div
        className="min-h-0"
        role={showTabs ? 'tabpanel' : 'region'}
        id="schema-file-panel"
        aria-labelledby={
          showTabs ? `schema-file-tab-${sdlActive ? files.length : activeIndex}` : undefined
        }
      >
        {sdlActive ? (
          <SdlPane schemaSDL={schemaSDL} />
        ) : activeFile ? (
          <SourceEditor
            filename={activeFile.filename}
            source={activeFile.content}
            highlights={activeFile.highlights}
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
