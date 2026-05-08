'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ConsoleLogRow } from './ConsoleLogRow';
import type { ConsoleFilter, ConsoleLogEntry } from './types';

interface Props {
  logs: ConsoleLogEntry[];
  onClear: () => void;
  onClose: () => void;
}

const FILTERS: Array<{ key: ConsoleFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'errors', label: 'Errors' },
  { key: 'warnings', label: 'Warnings' },
  { key: 'logs', label: 'Logs' },
];

export function ConsoleDrawer({ logs, onClear, onClose }: Props) {
  const [filter, setFilter] = useState<ConsoleFilter>('all');
  const rootRef = useRef<HTMLElement>(null);
  const firstFilterRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const visible = useMemo(() => {
    switch (filter) {
      case 'errors':
        return logs.filter((l) => l.kind === 'error');
      case 'warnings':
        return logs.filter((l) => l.kind === 'warn');
      case 'logs':
        return logs.filter((l) => l.kind === 'log' || l.kind === 'info');
      default:
        return logs;
    }
  }, [filter, logs]);

  // On open: remember the toggling button so we can return focus on close,
  // then move focus into the drawer. On close: return focus to where it was.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    }
    firstFilterRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, []);

  // Escape closes the drawer when focus is anywhere inside it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      const root = rootRef.current;
      if (!root) {
        return;
      }
      if (root.contains(document.activeElement)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <section
      ref={rootRef}
      className="grid grid-rows-[auto_1fr] border-t border-bm-line bg-bm-bg"
      style={{ height: 156 }}
      aria-label="Console"
    >
      <div
        role="tablist"
        aria-label="Console filters"
        className="flex items-center px-6 h-8 border-b border-bm-line gap-4"
      >
        <span className="text-[11px] uppercase tracking-[0.08em] text-bm-ink">Console</span>
        {FILTERS.map((f, i) => {
          const isActive = filter === f.key;
          return (
            <button
              type="button"
              key={f.key}
              ref={i === 0 ? firstFilterRef : undefined}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setFilter(f.key)}
              className={`text-[11px] py-1 -mb-px border-b-[1.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bm-accent ${
                isActive
                  ? 'text-bm-ink border-bm-accent'
                  : 'text-bm-ink-muted border-transparent hover:text-bm-ink'
              }`}
            >
              {f.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClear}
          className="text-bm-ink-muted hover:text-bm-ink text-[11px]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-bm-ink-muted hover:text-bm-ink text-[14px]"
          aria-label="Close console"
        >
          ×
        </button>
      </div>
      <div className="overflow-auto px-6 py-2 font-mono text-[12px] leading-[1.7]">
        {visible.length === 0 && <div className="text-bm-ink-muted italic py-1">No messages.</div>}
        {visible.map((entry) => (
          <ConsoleLogRow key={entry.id} entry={entry} />
        ))}
      </div>
    </section>
  );
}
