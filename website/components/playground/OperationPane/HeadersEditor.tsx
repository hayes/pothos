'use client';

import { useId } from 'react';
import type { HeaderEntry } from './types';

interface Props {
  headers: HeaderEntry[];
  onChange: (headers: HeaderEntry[]) => void;
}

export function HeadersEditor({ headers, onChange }: Props) {
  // Stable id prefix for newly-added rows. Combined with a per-row counter
  // (length-based), this gives us deterministic ids without a module-scoped
  // counter that gets shared across instances/HMR reloads.
  const idPrefix = useId();

  const update = (id: string, patch: Partial<HeaderEntry>) =>
    onChange(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));

  const remove = (id: string) => onChange(headers.filter((h) => h.id !== id));

  const add = () =>
    onChange([
      ...headers,
      { id: `${idPrefix}-h-${headers.length}-${Date.now()}`, name: '', value: '' },
    ]);

  return (
    <div className="px-6 py-5 font-mono text-[12px]">
      <div className="grid grid-cols-[160px_1fr_28px] gap-x-3 gap-y-1.5">
        {headers.map((h) => (
          <HeaderRow key={h.id} entry={h} onUpdate={update} onRemove={remove} />
        ))}
      </div>
      <div className="pt-3">
        <button
          type="button"
          onClick={add}
          className="rounded border border-dashed border-bm-line px-3 py-1.5 text-bm-ink-muted hover:border-bm-ink-muted hover:text-bm-ink text-[12px]"
        >
          + Add header
        </button>
      </div>
    </div>
  );
}

function HeaderRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: HeaderEntry;
  onUpdate: (id: string, patch: Partial<HeaderEntry>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <input
        value={entry.name}
        onChange={(e) => onUpdate(entry.id, { name: e.target.value })}
        placeholder="Authorization"
        aria-label="Header name"
        className="bg-transparent border-b border-bm-line py-1.5 text-bm-ink-muted outline-none focus:border-bm-accent"
      />
      <input
        value={entry.value}
        onChange={(e) => onUpdate(entry.id, { value: e.target.value })}
        placeholder="Bearer eyJhbGc…"
        aria-label="Header value"
        className="bg-transparent border-b border-bm-line py-1.5 text-bm-ink outline-none focus:border-bm-accent"
      />
      <button
        type="button"
        onClick={() => onRemove(entry.id)}
        className="text-bm-ink-muted hover:text-bm-danger text-[14px] py-1.5"
        aria-label="Remove header"
      >
        ×
      </button>
    </>
  );
}
