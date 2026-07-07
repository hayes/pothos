'use client';

import { useEffect, useRef, useState } from 'react';

interface ComposerProps {
  /** Top-left anchor in document coordinates. */
  position: { top: number; left: number } | null;
  /** Quote of selection or preview of element, for display. */
  preview: string;
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Floating composer that pops up next to a selection or clicked element.
 * Closes on escape, on outside-click, and on submit.
 */
export function Composer({ position, preview, onSubmit, onCancel }: ComposerProps) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onCancel();
    };
    window.addEventListener('keydown', onKey);
    // Defer outside-click handler so the click that opened us doesn't close us.
    const t = window.setTimeout(() => window.addEventListener('mousedown', onClick), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
      window.clearTimeout(t);
    };
  }, [onCancel]);

  if (!position) return null;

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={ref}
      className="rp-popover"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {preview && <div className="rp-quote">"{preview.slice(0, 140)}"</div>}
      <textarea
        ref={textRef}
        value={body}
        placeholder="What about this?"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
        style={{
          width: '100%',
          minHeight: 64,
          marginTop: 6,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--rp-border)',
          borderRadius: 6,
          padding: 6,
          color: 'inherit',
          font: 'inherit',
        }}
      />
      <div className="rp-composer-row" style={{ marginTop: 6 }}>
        <button type="button" className="rp-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="rp-btn"
          data-primary="true"
          disabled={busy || !body.trim()}
          onClick={handleSubmit}
        >
          {busy ? 'Saving…' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
