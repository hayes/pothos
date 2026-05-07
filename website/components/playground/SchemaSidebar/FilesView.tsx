'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlaygroundFile } from '../types';

const PROTECTED_FILENAME = 'schema.ts';

interface Props {
  files: PlaygroundFile[];
  activeIndex: number;
  sdlActive: boolean;
  onSelectFile: (index: number) => void;
  onAddFile: () => void;
  onRenameFile: (index: number, name: string) => boolean;
  onRemoveFile: (index: number) => void;
}

/**
 * The Files-tab body: just the list of user-editable files plus a "new"
 * button. The sidebar owns the surrounding chrome (header, tab strip).
 */
export function FilesView({
  files,
  activeIndex,
  sdlActive,
  onSelectFile,
  onAddFile,
  onRenameFile,
  onRemoveFile,
}: Props) {
  const [renameIndex, setRenameIndex] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  return (
    <div className="flex flex-col gap-2">
      <ul className="font-mono text-[12px]">
        {files.map((file, i) => {
          const isActive = !sdlActive && i === activeIndex;
          const isRenaming = renameIndex === i;
          const canDelete = files.length > 1 && file.filename !== PROTECTED_FILENAME;
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

      <button
        type="button"
        onClick={onAddFile}
        className="mx-4 my-1 rounded border border-dashed border-bm-line px-3 py-1.5 text-[12px] text-bm-ink-muted hover:border-bm-ink-muted hover:text-bm-ink"
      >
        + New file
      </button>
    </div>
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
          className="w-full pl-4 pr-3 py-1 bg-transparent text-bm-ink outline-none border-l-2 border-bm-accent"
        />
      </li>
    );
  }

  return (
    <li className="group">
      <div
        className={`flex items-center pr-3 border-l-2 ${
          active
            ? 'border-bm-accent bg-bm-surface-alt'
            : 'border-transparent hover:bg-bm-surface-alt/50'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onStartRename}
          className={`flex-1 truncate text-left pl-4 py-1 ${
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
