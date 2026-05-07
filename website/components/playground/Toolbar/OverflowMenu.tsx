'use client';

import { useEffect, useRef } from 'react';

export interface OverflowItem {
  label: string;
  shortcut?: string;
  onSelect: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: OverflowItem[];
}

export function OverflowMenu({ open, onClose, items }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute top-full right-6 mt-1 min-w-[220px] z-20 bg-bm-bg border border-bm-line rounded p-1.5 shadow-lg"
    >
      {items.map((item, i) =>
        item.label === '—' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: separator items
          <div key={`sep-${i}`} className="h-px bg-bm-line my-1" aria-hidden="true" />
        ) : (
          <button
            type="button"
            key={item.label}
            role="menuitem"
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className="flex w-full justify-between items-center px-2.5 py-1.5 rounded text-[13px] text-bm-ink hover:bg-bm-surface-alt"
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="font-mono text-[10px] text-bm-ink-muted">{item.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>
  );
}
