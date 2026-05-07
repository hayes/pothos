'use client';

import type { ReactNode } from 'react';

export interface PaneTab {
  key: string;
  label: ReactNode;
  active?: boolean;
  italic?: boolean;
  onClick?: () => void;
}

interface Props {
  tabs: PaneTab[];
  meta?: ReactNode;
  /** Optional element rendered between tabs and meta (e.g. dirty-dot, count). */
  end?: ReactNode;
  /** Tighter header (e.g. for sub-tab strips). */
  dense?: boolean;
}

export function PaneHeader({ tabs, meta, end, dense = false }: Props) {
  return (
    <div
      className={`flex items-center px-6 border-b border-bm-line bg-bm-bg ${
        dense ? 'h-8' : 'h-11'
      }`}
    >
      <div className="flex gap-[22px] h-full font-mono">
        {tabs.map((t) => (
          <PaneTabButton key={t.key} tab={t} />
        ))}
      </div>
      <div className="flex-1" />
      {end}
      {meta != null && (
        <div className="text-[11px] uppercase tracking-[0.04em] text-bm-ink-muted">{meta}</div>
      )}
    </div>
  );
}

function PaneTabButton({ tab }: { tab: PaneTab }) {
  const colorClass = tab.active ? 'text-bm-ink font-medium' : 'text-bm-ink-muted';
  const italic = tab.italic ? 'italic' : '';
  const underline = tab.active
    ? 'border-b-[1.5px] border-bm-accent'
    : 'border-b-[1.5px] border-transparent';
  return (
    <button
      type="button"
      onClick={tab.onClick}
      className={`flex items-center text-[13px] -mb-px tracking-[-0.01em] cursor-pointer transition-colors ${colorClass} ${italic} ${underline}`}
    >
      {tab.label}
    </button>
  );
}
