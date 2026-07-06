import type { ReactNode } from 'react';

interface Props {
  filename: string;
  language?: string;
  children: ReactNode;
}

/**
 * Floating "code-in-a-window" presentation block. Three muted dots,
 * filename in mono, language label on the right. The body is opaque
 * highlighted code rendered however the caller wants (server-rendered
 * static HTML or a client editor).
 */
export function CodeWindow({ filename, language = 'TypeScript', children }: Props) {
  return (
    <div className="rounded-xl border border-bm-line overflow-hidden bg-bm-editor-bg">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-bm-line bg-bm-surface">
        <span className="size-2 rounded-full bg-bm-line" aria-hidden="true" />
        <span className="size-2 rounded-full bg-bm-line" aria-hidden="true" />
        <span className="size-2 rounded-full bg-bm-accent/70" aria-hidden="true" />
        <span className="ml-2 font-mono text-[12px] text-bm-ink-muted">{filename}</span>
        <span className="flex-1" />
        <span className="text-[10px] uppercase tracking-[0.06em] text-bm-ink-muted">
          {language}
        </span>
      </div>
      {/* Long lines (e.g. the objectRef backing-model generic) scroll within
          the window rather than clipping under its rounded right edge. */}
      <div className="px-6 py-5 overflow-x-auto">{children}</div>
    </div>
  );
}
