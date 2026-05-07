'use client';

import { useMemo, useState } from 'react';
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

  return (
    <div
      className="grid grid-rows-[auto_1fr] border-t border-bm-line bg-bm-bg"
      style={{ height: 156 }}
    >
      <div className="flex items-center px-6 h-8 border-b border-bm-line gap-4">
        <span className="text-[11px] uppercase tracking-[0.08em] text-bm-ink">Console</span>
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-[11px] py-1 -mb-px border-b-[1.5px] ${
              filter === f.key
                ? 'text-bm-ink border-bm-accent'
                : 'text-bm-ink-muted border-transparent hover:text-bm-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
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
    </div>
  );
}
