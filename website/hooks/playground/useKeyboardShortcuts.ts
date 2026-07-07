'use client';

import { useEffect } from 'react';

interface Options {
  onRun: () => void;
}

/**
 * Page-level shortcuts. Cmd/Ctrl+Enter runs the active query.
 * (Per-editor Cmd+Enter is also wired so the shortcut works inside Monaco.)
 *
 * We skip the page-level handler when focus is inside a non-Monaco editable
 * input (sketch rename, Headers fields, Filter inputs, etc.) so those inputs
 * keep their default Enter behavior. Monaco editors handle their own Cmd+Enter.
 */
export function useKeyboardShortcuts({ onRun }: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const active = document.activeElement as HTMLElement | null;
        if (active) {
          const isEditable =
            active.matches('input, textarea, [contenteditable=true]') || active.isContentEditable;
          if (isEditable && !active.closest('.monaco-editor')) {
            return;
          }
        }
        e.preventDefault();
        onRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onRun]);
}
