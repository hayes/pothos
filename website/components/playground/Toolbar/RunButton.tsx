'use client';

import { Spinner } from '../shell/Spinner';

interface Props {
  running: boolean;
  onRun: () => void;
}

export function RunButton({ running, onRun }: Props) {
  if (running) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center justify-center gap-2 min-w-[110px] rounded text-[13px] font-medium tracking-[0.01em] px-3.5 py-1.5 cursor-progress bg-bm-surface-alt text-bm-ink-muted border border-bm-line"
      >
        <Spinner colorClass="text-bm-ink-muted" />
        Running…
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onRun}
      className="inline-flex items-center justify-center gap-2 min-w-[110px] rounded text-[13px] font-medium tracking-[0.01em] px-3.5 py-1.5 bg-bm-ink text-bm-bg hover:opacity-90"
    >
      <span>Run query</span>
      <kbd className="font-mono text-[10px] rounded px-1 py-0 opacity-55 border border-white/25">
        ⌘↵
      </kbd>
    </button>
  );
}
