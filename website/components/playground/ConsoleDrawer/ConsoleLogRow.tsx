'use client';

import type { ConsoleLogEntry } from './types';

interface Props {
  entry: ConsoleLogEntry;
}

const KIND_CLASS: Record<ConsoleLogEntry['kind'], string> = {
  error: 'text-bm-danger',
  warn: 'text-bm-warn',
  info: 'text-bm-ink-muted',
  log: 'text-bm-ink-muted',
};

export function ConsoleLogRow({ entry }: Props) {
  const kindClass = KIND_CLASS[entry.kind];
  // Top-aligned so multi-line messages (pretty-printed objects, error
  // bodies) read down from the timestamp instead of crowding against
  // the kind chip's center.
  return (
    <div className="flex gap-3.5 text-bm-ink-soft items-start">
      <span className="text-bm-ink-muted w-14 shrink-0 leading-5">{entry.timestamp}</span>
      <span
        className={`w-12 shrink-0 text-[10px] uppercase tracking-[0.06em] leading-5 ${kindClass}`}
      >
        {entry.kind}
      </span>
      <pre
        className={`min-w-0 flex-1 whitespace-pre-wrap break-all font-mono leading-5 m-0 ${
          entry.kind === 'error' ? 'text-bm-danger' : 'text-bm-ink'
        }`}
      >
        {entry.message}
      </pre>
    </div>
  );
}
