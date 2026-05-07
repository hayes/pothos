'use client';

import { useMemo } from 'react';
import { PaneHeader, type PaneTab } from '../shell/PaneHeader';
import type { PlaygroundFile } from '../types';
import { SdlPane } from './SdlPane';
import { SourceEditor } from './SourceEditor';

const SDL_TAB = 'schema.graphql';

interface Props {
  files: PlaygroundFile[];
  activeIndex: number;
  /** When true, the active tab is the read-only generated SDL. */
  sdlActive: boolean;
  schemaSDL: string | null;
  onSelectFile: (index: number) => void;
  onSelectSdl: () => void;
  onChange: (index: number, content: string) => void;
}

export function SchemaEditor({
  files,
  activeIndex,
  sdlActive,
  schemaSDL,
  onSelectFile,
  onSelectSdl,
  onChange,
}: Props) {
  const activeFile = files[activeIndex];

  const tabs = useMemo<PaneTab[]>(() => {
    const fileTabs: PaneTab[] = files.map((f, i) => ({
      key: f.filename,
      label: f.filename,
      active: !sdlActive && i === activeIndex,
      onClick: () => onSelectFile(i),
    }));
    fileTabs.push({
      key: SDL_TAB,
      label: SDL_TAB,
      italic: true,
      active: sdlActive,
      onClick: onSelectSdl,
    });
    return fileTabs;
  }, [files, activeIndex, sdlActive, onSelectFile, onSelectSdl]);

  const lineCount = activeFile?.content.split('\n').length ?? 0;
  const meta = sdlActive
    ? 'Generated SDL · read-only'
    : `TypeScript · ${lineCount} line${lineCount === 1 ? '' : 's'}`;

  return (
    <section className="grid grid-rows-[auto_1fr] min-w-0 border-r border-bm-line bg-bm-editor-bg">
      <PaneHeader tabs={tabs} meta={meta} />
      <div className="min-h-0">
        {sdlActive ? (
          <SdlPane schemaSDL={schemaSDL} />
        ) : activeFile ? (
          <SourceEditor
            filename={activeFile.filename}
            source={activeFile.content}
            allFiles={files}
            onChange={(value) => onChange(activeIndex, value)}
          />
        ) : null}
      </div>
    </section>
  );
}
