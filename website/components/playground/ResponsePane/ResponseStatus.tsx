'use client';

import type { ResponsePhase } from './types';

interface Props {
  phase: ResponsePhase;
}

function formatBytes(b: number): string {
  if (b < 1024) {
    return `${b} B`;
  }
  if (b < 1024 * 1024) {
    return `${(b / 1024).toFixed(1)} KB`;
  }
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1) {
    return '<1 ms';
  }
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1000).toFixed(2)} s`;
}

export function ResponseStatus({ phase }: Props) {
  if (phase.kind === 'idle') {
    return <span className="text-bm-ink-muted">no response yet</span>;
  }
  if (phase.kind === 'pending') {
    return <span className="text-bm-ink-muted">pending…</span>;
  }
  if (phase.kind === 'error') {
    return (
      <span className="inline-flex gap-3.5 items-center">
        <span className="text-bm-danger">
          ● {phase.status} OK · {phase.errorCount} error{phase.errorCount === 1 ? '' : 's'}
        </span>
        <span>{formatMs(phase.durationMs)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex gap-3.5 items-center">
      <span>{phase.status} OK</span>
      <span>{formatMs(phase.durationMs)}</span>
      <span>{formatBytes(phase.sizeBytes)}</span>
    </span>
  );
}
