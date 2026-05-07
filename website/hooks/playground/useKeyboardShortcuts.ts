'use client';

import { useEffect } from 'react';

interface Options {
  onRun: () => void;
}

/**
 * Page-level shortcuts. Cmd/Ctrl+Enter runs the active query.
 * (Per-editor Cmd+Enter is also wired so the shortcut works inside Monaco.)
 */
export function useKeyboardShortcuts({ onRun }: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onRun]);
}
