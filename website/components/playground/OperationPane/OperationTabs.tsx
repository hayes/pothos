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
 * Uses the same flat typographic style as PaneHeader (text + accent
 * underline) so the playground reads as a single tab system rather than
 * two competing ones. The dirty dot and close button distinguish operation
 * tabs from pane tabs.
 */
export function OperationTabs({ operations, activeIndex, onSelect, onClose, onAdd }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Operations"
      className="flex items-center px-6 h-11 border-b border-bm-line bg-bm-bg gap-[22px]"
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
        className="font-mono text-[13px] text-bm-ink-muted hover:text-bm-ink leading-none"
        title="New operation"
      >
        +
      </button>
      <div className="flex-1" />
      <span className="text-[11px] uppercase tracking-[0.04em] text-bm-ink-muted">
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
      className={`flex items-center gap-1.5 h-full -mb-px font-mono text-[13px] tracking-[-0.01em] cursor-pointer focus-visible:outline-none ${
        active
          ? 'text-bm-ink font-medium border-b-[1.5px] border-bm-accent'
          : 'text-bm-ink-muted border-b-[1.5px] border-transparent hover:text-bm-ink'
      }`}
    >
      <span>{operation.name}</span>
      {operation.dirty && (
        <span
          className="size-[5px] rounded-full bg-bm-accent"
          aria-hidden="true"
          title="unsaved"
        />
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
