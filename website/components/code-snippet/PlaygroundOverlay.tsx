'use client';

import { X } from 'lucide-react';
import { type FC, useMemo, useRef } from 'react';
import { encodePlaygroundState } from '@/lib/playground/url-state';
import { useModalFocusTrap } from './useModalFocusTrap';

export interface PlaygroundOverlayProps {
  /**
   * Example ID to load from the registry
   */
  exampleId?: string;

  /**
   * Custom code to load (alternative to exampleId)
   */
  code?: string;

  /**
   * GraphQL query to pre-populate (opens to GraphQL view)
   */
  query?: string;

  /**
   * Callback when overlay is closed
   */
  onClose: () => void;
}

/**
 * Full-screen overlay that loads the playground in an iframe.
 *
 * **Features:**
 * - Lazy-loaded iframe (playground bundle only loaded when opened)
 * - Examples loaded by the playground page on-demand
 * - Full-screen on mobile, 90% width on desktop
 * - Escape key to close
 * - Click outside to close
 */
export const PlaygroundOverlay: FC<PlaygroundOverlayProps> = ({
  exampleId,
  code,
  query,
  onClose,
}) => {
  // Build playground URL — `embed=1` puts the page in embedded mode
  // (no link-out on the wordmark, no examples picker, no default
  // "untitled sketch" placeholder). `example=` is read on mount and
  // resolved to a real example load. `query=` is base64-encoded so it
  // round-trips arbitrary GraphQL bodies.
  const playgroundURL = useMemo(() => {
    if (exampleId) {
      const params = new URLSearchParams();
      params.set('embed', '1');
      params.set('example', exampleId);
      if (query) {
        params.set('query', btoa(query));
      }
      return `/playground?${params.toString()}`;
    }

    if (code) {
      const state = encodePlaygroundState({
        files: [{ filename: 'schema.ts', content: code }],
        query,
        viewMode: query ? 'graphql' : 'code',
      });
      return `/playground?embed=1#${state}`;
    }

    return '/playground?embed=1';
  }, [exampleId, code, query]);

  // Focus into the dialog on open, restore focus on close, close on Escape.
  const dialogRef = useRef<HTMLDivElement>(null);
  const { focusFirst, focusLast } = useModalFocusTrap(dialogRef, onClose);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handler is in useEffect
    // biome-ignore lint/a11y/noStaticElementInteractions: This is an overlay backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal container */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: onClick is only to stop propagation */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pothos Playground"
        className="relative h-full w-full md:h-[90vh] md:w-[90vw] md:rounded-lg bg-fd-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Focus-trap sentinel: Shift+Tab off the first control lands here and
            wraps to the last focusable, keeping focus inside the dialog. This
            is the standard focus-guard pattern (empty, hidden from AT, only
            reachable via Tab to redirect focus back into the dialog). */}
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: intentional focus-trap sentinel — hidden from AT, exists only to catch Tab and redirect */}
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: intentional focus-trap sentinel — must be Tab-reachable to wrap focus */}
        <span data-focus-guard tabIndex={0} aria-hidden="true" onFocus={focusLast} />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-md bg-fd-background/95 p-2 text-fd-muted-foreground backdrop-blur transition-colors hover:bg-fd-accent hover:text-fd-foreground"
          aria-label="Close playground"
        >
          <X size={20} />
        </button>

        {/* Playground iframe */}
        <iframe
          src={playgroundURL}
          className="h-full w-full md:rounded-lg"
          title="Pothos Playground"
          allow="clipboard-write"
        />

        {/* Focus-trap sentinel: Tab off the last control lands here and wraps
            back to the first focusable. */}
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: intentional focus-trap sentinel — hidden from AT, exists only to catch Tab and redirect */}
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: intentional focus-trap sentinel — must be Tab-reachable to wrap focus */}
        <span data-focus-guard tabIndex={0} aria-hidden="true" onFocus={focusFirst} />
      </div>
    </div>
  );
};
