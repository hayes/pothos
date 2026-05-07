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
  return (
    <div className="flex gap-3.5 text-bm-ink-soft">
      <span className="text-bm-ink-muted w-14 shrink-0">{entry.timestamp}</span>
      <span
        className={`w-12 shrink-0 self-center text-[10px] uppercase tracking-[0.06em] ${kindClass}`}
      >
        {entry.kind}
      </span>
      <span className={entry.kind === 'error' ? 'text-bm-danger' : 'text-bm-ink'}>
        {entry.message}
      </span>
    </div>
  );
}
