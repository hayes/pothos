'use client';

import type { KeyboardEvent } from 'react';
import type { Operation } from './types';

interface Props {
  operations: Operation[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
  onAdd: () => void;
}

/**
 * Top row of the operation pane — one tab per parallel query, plus a `+`.
 * Active tab gets an accent top border + matches the editor surface.
 */
export function OperationTabs({ operations, activeIndex, onSelect, onClose, onAdd }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Operations"
      className="flex items-center px-3.5 h-9 border-b border-bm-line bg-bm-bg gap-0.5"
    >
      {operations.map((op, i) => (
        <OperationTab
          key={op.id}
          operation={op}
          active={i === activeIndex}
          onSelect={() => onSelect(i)}
          onClose={() => onClose(i)}
          closable={operations.length > 1}
        />
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="px-2 py-1 text-bm-ink-muted hover:text-bm-ink text-[14px]"
        title="New operation"
      >
        +
      </button>
      <div className="flex-1" />
      <span className="text-bm-ink-muted text-[11px]">
        {operations.length} operation{operations.length === 1 ? '' : 's'}
      </span>
    </div>
  );
}

function OperationTab({
  operation,
  active,
  onSelect,
  onClose,
  closable,
}: {
  operation: Operation;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  closable: boolean;
}) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <div
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKey}
      className={`-mb-px flex items-center gap-1.5 px-3 py-1.5 rounded-t font-mono text-[12px] cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bm-accent ${
        active
          ? 'bg-bm-editor-bg border-t-2 border-x border-t-bm-accent border-x-bm-line text-bm-ink'
          : 'border-t-2 border-t-transparent text-bm-ink-soft hover:bg-bm-surface-alt'
      }`}
    >
      <span>{operation.name}</span>
      {operation.dirty && (
        <span className="size-[5px] rounded-full bg-bm-accent" aria-hidden="true" title="unsaved" />
      )}
      {closable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 text-bm-ink-muted hover:text-bm-ink text-[14px] leading-none"
          aria-label={`Close ${operation.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
