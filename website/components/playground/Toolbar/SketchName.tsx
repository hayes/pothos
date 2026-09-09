'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

/**
 * Italic Fraunces sketch name with click-to-rename.
 * Dashed underline appears on hover/focus to hint editability.
 */
export function SketchName({ value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
          }
          if (e.key === 'Escape') {
            setEditing(false);
          }
        }}
        className="font-serif text-[13px] italic bg-transparent border-b border-bm-line outline-none text-bm-ink-muted focus:text-bm-ink"
        size={Math.max(draft.length, 8)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename"
      className="bm-sketch-name font-serif text-[13px] italic text-bm-ink-muted hover:text-bm-ink-soft"
    >
      {value}
    </button>
  );
}
