'use client';

export type SchemaStatusKind = 'idle' | 'compiling' | 'error';

export interface SchemaStatus {
  kind: SchemaStatusKind;
  /** Human-readable status text. */
  text: string;
  /** Optional click handler — used when error to open the console. */
  onClick?: () => void;
}

interface Props {
  status: SchemaStatus;
}

export function StatusPill({ status }: Props) {
  const { kind, onClick } = status;

  const dotClass =
    kind === 'error'
      ? 'bg-bm-danger'
      : kind === 'compiling'
        ? 'bg-bm-ink-muted animate-bm-pulse'
        : 'bg-bm-accent';

  const textClass =
    kind === 'error' ? 'text-bm-danger underline underline-offset-[3px]' : 'text-bm-ink-muted';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-live="polite"
      className={`flex items-center gap-2 text-[12px] tracking-[0.02em] disabled:cursor-default ${textClass}`}
    >
      <span className={`size-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      <span>{status.text}</span>
    </button>
  );
}
