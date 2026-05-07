'use client';

import { type ReactNode, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Anchor edge — `left` or `right`. */
  align?: 'left' | 'right';
  /** Width in px. */
  width?: number;
  className?: string;
  children: ReactNode;
}

export function Popover({ open, onClose, align = 'left', width, className = '', children }: Props) {
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
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        onMouseDown={onClose}
        className="fixed inset-0 z-[19] bg-transparent"
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        style={{ [align]: 0, width }}
        className={`absolute top-full mt-1.5 z-20 bg-bm-bg border border-bm-line rounded-md overflow-hidden ${className}`}
      >
        {children}
      </div>
    </>
  );
}
