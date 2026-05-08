'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlaygroundFile } from '../types';

const PROTECTED_FILENAME = 'schema.ts';

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

/**
 * The Files-tab body — generated SDL pinned at the top (read-only),
 * then user files, then a "new" action. The sidebar owns the
 * surrounding chrome.
 */
export function FilesView({
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
    <div className="flex flex-col font-mono text-[12px]">
      {/* User files first — these are what people edit */}
      <ul>
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
        className="mx-4 mt-3 mb-1 rounded border border-dashed border-bm-line px-3 py-1.5 text-[12px] text-bm-ink-muted hover:border-bm-ink-muted hover:text-bm-ink"
      >
        + New file
      </button>

      {/* Generated SDL — clearly labeled as a separate section. The
          row reads as a file (not italic, regular weight) with a small
          "view" caret on the right so it's obviously clickable. */}
      <div className="mt-5 px-4 pb-1.5 text-[10px] uppercase tracking-[0.1em] text-bm-ink-muted">
        Generated
      </div>
      <button
        type="button"
        onClick={onSelectSdl}
        title="Generated SDL — read-only · click to view"
        className={`group/row flex items-center gap-2 pr-3 border-l-2 transition-colors ${
          sdlActive
            ? 'border-bm-accent bg-bm-surface-alt text-bm-ink font-medium'
            : 'border-transparent text-bm-ink-soft hover:bg-bm-surface-alt/50 hover:text-bm-ink'
        }`}
      >
        <span className="flex-1 truncate text-left pl-4 py-1.5">schema.graphql</span>
        <LockIcon />
        <ChevronRight />
      </button>
    </div>
  );
}

function ChevronRight() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="opacity-50 group-hover/row:opacity-100 transition-opacity"
    >
      <polyline points="3.5 2 6.5 5 3.5 8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      className="opacity-70 shrink-0"
    >
      <rect x="2" y="4.5" width="6" height="4" rx="0.5" />
      <path d="M3.5 4.5V3a1.5 1.5 0 113 0v1.5" />
    </svg>
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
    if (renaming) {
      inputRef.current?.select();
    }
  }, [renaming]);

  if (renaming) {
    return (
      <li>
        <div className="flex items-center pr-2 border-l-2 border-bm-accent bg-bm-accent-soft">
          <input
            ref={inputRef}
            value={renameDraft}
            onChange={(e) => onChangeDraft(e.target.value)}
            onBlur={() => onCommitRename(renameDraft)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onCommitRename(renameDraft);
              }
              if (e.key === 'Escape') {
                onCancelRename();
              }
            }}
            className="flex-1 pl-4 pr-2 py-1 my-0.5 bg-bm-surface text-bm-ink rounded font-mono text-[12px] border border-bm-accent outline-none focus:ring-1 focus:ring-bm-accent shadow-sm"
            placeholder="filename.ts"
          />
          <span className="ml-2 mr-1 text-[10px] text-bm-ink-muted bm-mono shrink-0">⏎</span>
        </div>
      </li>
    );
  }

  return (
    <li className="group/row">
      <div
        className={`flex items-center pr-2 border-l-2 transition-colors ${
          active
            ? 'border-bm-accent bg-bm-surface-alt'
            : 'border-transparent hover:bg-bm-surface-alt/50'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={onStartRename}
          className={`flex-1 truncate text-left pl-4 py-1.5 ${
            active ? 'text-bm-ink font-medium' : 'text-bm-ink-soft hover:text-bm-ink'
          }`}
          title="Click to open · Double-click to rename"
        >
          {filename}
        </button>
        {canDelete && (
          <button
            type="button"
            onClick={onRemove}
            className="opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus:opacity-100 text-bm-ink-muted hover:text-bm-danger px-1.5 text-[14px] leading-none transition-opacity"
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
