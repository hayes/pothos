'use client';

import { type RefObject, useCallback, useEffect } from 'react';

/**
 * Focus management for a modal dialog rendered inline in the document (not a
 * portal). Handles the three things a keyboard/screen-reader user needs:
 *
 * 1. Moves focus into the dialog when it opens.
 * 2. Restores focus to whatever was focused before (the trigger) on close.
 * 3. Closes on Escape while focus is within the parent document.
 *
 * Tab-wrapping (the actual trap) is done with two focus-guard sentinels the
 * caller renders as the first and last children of the dialog. This hook
 * returns `focusFirst` / `focusLast` for their `onFocus` handlers so Tab out
 * of either end loops back into the dialog instead of leaking to the page
 * behind the overlay.
 *
 * Note: Escape can only be observed here while focus is in the parent
 * document. Once focus moves inside the playground `<iframe>`, key events fire
 * in the frame's own document; we deliberately don't hijack them so the
 * embedded editor keeps its own Escape behavior. Tabbing back to the close
 * button (one Shift+Tab) restores Escape/close.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('data-focus-guard') && el.offsetParent !== null,
  );
}

export function useModalFocusTrap(dialogRef: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (its first focusable — the close button).
    getFocusable(dialogRef.current)[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // Return focus to the element that opened the dialog.
      previouslyFocused?.focus?.();
    };
  }, [dialogRef, onClose]);

  const focusFirst = useCallback(() => {
    getFocusable(dialogRef.current)[0]?.focus();
  }, [dialogRef]);

  const focusLast = useCallback(() => {
    const els = getFocusable(dialogRef.current);
    els[els.length - 1]?.focus();
  }, [dialogRef]);

  return { focusFirst, focusLast };
}
