'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { PaletteGroup } from './palettes';

interface Props {
  label: string;
  /** 6-digit hex with no leading `#`. */
  value: string;
  onChange: (next: string) => void;
  description?: string;
  /** Quick-pick palette groups. When provided, shown in a popover when
   *  the user opens the swatch popover trigger. */
  swatches?: PaletteGroup[];
}

const HEX_RE = /^[0-9a-fA-F]{6}$/;

/**
 * Single labeled color slot — color picker swatch + 6-digit hex input,
 * both editing the same value. The picker is just for quick eyeballing;
 * the hex input is the source of truth. An optional palette popover lets
 * users grab one of the design tokens directly.
 */
export function ColorRow({ label, value, onChange, description, swatches }: Props) {
  const id = useId();
  const safe = HEX_RE.test(value) ? value : '000000';
  const [paletteOpen, setPaletteOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [paletteOpen]);

  const handleHex = (raw: string) => {
    const cleaned = raw.replace(/^#/, '').toLowerCase();
    if (HEX_RE.test(cleaned)) onChange(cleaned);
    else if (cleaned.length <= 6) onChange(cleaned);
  };

  return (
    <div className="relative flex items-center gap-3 px-4 py-1.5">
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
      {swatches && swatches.length > 0 && (
        <button
          type="button"
          onClick={() => setPaletteOpen((s) => !s)}
          className="text-bm-ink-muted hover:text-bm-ink text-[14px] leading-none px-1"
          title="Pick from palette"
          aria-label="Pick from palette"
        >
          ⋯
        </button>
      )}
      {paletteOpen && swatches && (
        <div
          ref={popoverRef}
          className="absolute right-2 top-full mt-1 z-30 w-[260px] bg-bm-bg border border-bm-line rounded shadow-lg p-2 grid gap-2"
        >
          {swatches.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] uppercase tracking-[0.08em] text-bm-ink-muted px-1 pb-1">
                {group.label}
              </div>
              <div className="grid grid-cols-8 gap-1">
                {group.swatches.map((sw) => (
                  <button
                    type="button"
                    key={sw.hex + sw.name}
                    onClick={() => {
                      onChange(sw.hex);
                      setPaletteOpen(false);
                    }}
                    title={`${sw.name} · #${sw.hex}`}
                    className="size-5 rounded border border-bm-line hover:scale-110 transition-transform"
                    style={{ backgroundColor: `#${sw.hex}` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
