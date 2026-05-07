'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlaygroundFile } from '../types';

interface Props {
  files: PlaygroundFile[];
  activeIndex: number;
  sdlActive: boolean;
  onSelectFile: (index: number) => void;
  onSelectSdl: () => void;
  onAddFile: () => void;
  onRenameFile: (index: number, name: string) => boolean;
  onRemoveFile: (index: number) => void;
}

const SDL_FILENAME = 'schema.graphql';

/**
 * Sidebar file list for the schema editor.
 *
 * - User files at top with add / rename / delete.
 * - The generated SDL appears below as a virtual italic entry.
 * - `schema.ts` is treated as the protected entrypoint and can't be removed.
 */
export function FileTree({
  files,
  activeIndex,
  sdlActive,
  onSelectFile,
  onSelectSdl,
  onAddFile,
  onRenameFile,
  onRemoveFile,
}: Props) {
  const [renameIndex, setRenameIndex] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  return (
    <aside className="flex flex-col min-h-0 bg-bm-bg border-r border-bm-line w-[180px]">
      <header className="flex items-center justify-between px-4 h-11 border-b border-bm-line text-[11px] uppercase tracking-[0.08em] text-bm-ink-muted">
        <span>Files</span>
        <button
          type="button"
          onClick={onAddFile}
          title="New file"
          className="text-bm-ink-muted hover:text-bm-ink leading-none text-[14px]"
          aria-label="Add file"
        >
          +
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-auto py-2">
        <ul className="font-mono text-[12px]">
          {files.map((file, i) => {
            const isActive = !sdlActive && i === activeIndex;
            const isRenaming = renameIndex === i;
            const canDelete = files.length > 1 && file.filename !== 'schema.ts';
            return (
              <FileRow
                key={file.filename}
                filename={file.filename}
                active={isActive}
                renaming={isRenaming}
                renameDraft={renameDraft}
                canDelete={canDelete}
                onSelect={() => onSelectFile(i)}
                onStartRename={() => {
                  setRenameIndex(i);
                  setRenameDraft(file.filename);
                }}
                onCommitRename={(next) => {
                  if (next !== file.filename && next.trim()) {
                    onRenameFile(i, next.trim());
                  }
                  setRenameIndex(null);
                }}
                onCancelRename={() => setRenameIndex(null)}
                onChangeDraft={setRenameDraft}
                onRemove={() => onRemoveFile(i)}
              />
            );
          })}
        </ul>

        <div className="mt-3 px-4 pb-1 text-[10px] uppercase tracking-[0.08em] text-bm-ink-muted">
          Generated
        </div>
        <ul className="font-mono text-[12px]">
          <button
            type="button"
            onClick={onSelectSdl}
            className={`flex w-full items-center pl-3 pr-2 py-1 italic text-left border-l-2 transition-colors ${
              sdlActive
                ? 'border-bm-accent bg-bm-surface-alt text-bm-ink font-medium'
                : 'border-transparent text-bm-ink-muted hover:text-bm-ink'
            }`}
          >
            {SDL_FILENAME}
          </button>
        </ul>
      </div>
    </aside>
  );
}

interface FileRowProps {
  filename: string;
  active: boolean;
  renaming: boolean;
  renameDraft: string;
  canDelete: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: (next: string) => void;
  onCancelRename: () => void;
  onChangeDraft: (next: string) => void;
  onRemove: () => void;
}

function FileRow({
  filename,
  active,
  renaming,
  renameDraft,
  canDelete,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onChangeDraft,
  onRemove,
}: FileRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  if (renaming) {
    return (
      <li>
        <input
          ref={inputRef}
          value={renameDraft}
          onChange={(e) => onChangeDraft(e.target.value)}
          onBlur={() => onCommitRename(renameDraft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitRename(renameDraft);
            if (e.key === 'Escape') onCancelRename();
          }}
          className="w-full pl-3 pr-2 py-1 bg-transparent text-bm-ink outline-none border-l-2 border-bm-accent"
        />
      </li>
    );
  }

  return (
    <li className="group">
      <div
        className={`flex items-center pr-2 border-l-2 ${
          active
            ? 'border-bm-accent bg-bm-surface-alt'
            : 'border-transparent hover:bg-bm-surface-alt/50'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onStartRename}
          className={`flex-1 truncate text-left pl-3 py-1 ${
            active ? 'text-bm-ink font-medium' : 'text-bm-ink-soft'
          }`}
          title="Click to open · Double-click to rename"
        >
          {filename}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 text-bm-ink-muted hover:text-bm-danger px-1 text-[14px] leading-none transition-opacity"
            aria-label={`Delete ${filename}`}
            title="Delete"
          >
            ×
          </button>
        )}
      </div>
    </li>
  );
}
