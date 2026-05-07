'use client';

import { useMemo, useState } from 'react';
import type { ExampleMetadata } from '../examples';
import { groupExamples, type PickerGroup } from './categoryMap';

interface Props {
  examples: readonly ExampleMetadata[];
  onPick: (id: string) => void;
  onClose: () => void;
}

function matchesQuery(ex: ExampleMetadata, q: string): boolean {
  if (!q) {
    return true;
  }
  const needle = q.toLowerCase();
  if (ex.title.toLowerCase().includes(needle)) {
    return true;
  }
  if (ex.description?.toLowerCase().includes(needle)) {
    return true;
  }
  return ex.tags.some((t) => t.toLowerCase().includes(needle));
}

function filterGroup(group: PickerGroup, q: string): PickerGroup {
  return { ...group, items: group.items.filter((ex) => matchesQuery(ex, q)) };
}

function stepCount(ex: ExampleMetadata): number {
  return ex.steps?.length ?? 1;
}

export function ExamplesPicker({ examples, onPick, onClose }: Props) {
  const [q, setQ] = useState('');
  const allGroups = useMemo(() => groupExamples(examples), [examples]);
  const filtered = useMemo(
    () => allGroups.map((g) => filterGroup(g, q)).filter((g) => g.items.length > 0),
    [allGroups, q],
  );

  return (
    <>
      <div
        onMouseDown={onClose}
        className="fixed inset-0 z-[19] bg-transparent"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Load example"
        className="absolute left-0 top-full mt-1.5 z-20 w-[540px] max-h-[480px] grid grid-rows-[auto_1fr] bg-bm-bg border border-bm-line rounded-md overflow-hidden shadow-xl"
      >
        <div className="px-3.5 py-3 border-b border-bm-line">
          <input
            // biome-ignore lint/a11y/noAutofocus: popover-style picker autofocus is the expected UX
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search examples (try "relay", "prisma", "auth")…'
            className="w-full bg-transparent border-none outline-none text-[14px] text-bm-ink placeholder:text-bm-ink-muted"
          />
        </div>

        <div className="overflow-auto py-1.5">
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-bm-ink-muted">
              No examples match "{q}"
            </div>
          )}
          {filtered.map((group) => (
            <div key={group.id}>
              <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-[0.1em] text-bm-ink-muted">
                {group.label}
              </div>
              {group.items.map((ex) => (
                <button
                  type="button"
                  key={ex.id}
                  onClick={() => onPick(ex.id)}
                  className="flex w-full items-baseline justify-between px-4 py-1.5 text-left text-[13px] text-bm-ink hover:bg-bm-surface-alt"
                >
                  <span>
                    <span>{ex.title}</span>
                    {ex.description && (
                      <span className="ml-2.5 text-[12px] text-bm-ink-muted">{ex.description}</span>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-bm-ink-muted">
                    {stepCount(ex)} step{stepCount(ex) === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
