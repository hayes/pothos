'use client';

import { useId } from 'react';

interface Props {
  label: string;
  /** 6-digit hex with no leading `#`. */
  value: string;
  onChange: (next: string) => void;
  description?: string;
}

const HEX_RE = /^[0-9a-fA-F]{6}$/;

/**
 * Single labeled color slot — color picker swatch + 6-digit hex input,
 * both editing the same value. The picker is just for quick eyeballing;
 * the hex input is the source of truth.
 */
export function ColorRow({ label, value, onChange, description }: Props) {
  const id = useId();
  const safe = HEX_RE.test(value) ? value : '000000';
  const handleHex = (raw: string) => {
    const cleaned = raw.replace(/^#/, '').toLowerCase();
    if (HEX_RE.test(cleaned)) onChange(cleaned);
    else if (cleaned.length <= 6) onChange(cleaned);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-1.5">
      <input
        type="color"
        value={`#${safe}`}
        onChange={(e) => onChange(e.target.value.replace(/^#/, ''))}
        aria-label={`${label} color picker`}
        className="size-5 rounded shrink-0 border border-bm-line bg-transparent cursor-pointer"
      />
      <label htmlFor={id} className="flex-1 text-[12px] text-bm-ink-soft truncate">
        {label}
        {description && (
          <span className="block text-[10px] text-bm-ink-muted">{description}</span>
        )}
      </label>
      <span className="text-bm-ink-muted text-[12px] font-mono">#</span>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => handleHex(e.target.value)}
        spellCheck={false}
        maxLength={6}
        className="w-[64px] font-mono text-[12px] text-bm-ink bg-bm-surface-alt border border-bm-line rounded px-1.5 py-0.5 outline-none focus:border-bm-accent"
      />
    </div>
  );
}
