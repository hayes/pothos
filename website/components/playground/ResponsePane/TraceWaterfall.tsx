'use client';

import type { TraceRow } from './types';

interface Props {
  rows: TraceRow[];
}

function formatSelf(ms: number): string {
  if (ms < 1) {
    return '<1 ms';
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

export function TraceWaterfall({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-bm-ink-muted text-[13px] italic">
        Trace data is collected when a query runs against the in-memory schema.
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.selfMs), 1);
  return (
    <div className="px-6 py-5 font-mono text-[12px]">
      <div className="grid grid-cols-[180px_1fr_80px_140px] gap-3 pb-1.5 border-b border-bm-line text-[10px] uppercase tracking-[0.06em] text-bm-ink-muted">
        <span>Path</span>
        <span>Self</span>
        <span>Self ms</span>
        <span>Resolver</span>
      </div>
      {rows.map((row, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are stable position-based
          key={`${row.path}-${i}`}
          className="grid grid-cols-[180px_1fr_80px_140px] gap-3 py-1.5 items-center border-b border-bm-line"
        >
          <span className="text-bm-ink truncate">{row.path}</span>
          <span className="relative h-1.5 bg-bm-surface-alt rounded-sm">
            <span
              className="absolute inset-y-0 left-0 bg-bm-accent rounded-sm"
              style={{ width: `${Math.max(2, (row.selfMs / max) * 100)}%` }}
            />
          </span>
          <span className="text-bm-ink-soft text-right">{formatSelf(row.selfMs)}</span>
          <span className="text-bm-ink-muted truncate">{row.resolver}</span>
        </div>
      ))}
    </div>
  );
}
