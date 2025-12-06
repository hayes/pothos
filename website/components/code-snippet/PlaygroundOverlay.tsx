'use client';

import { X } from 'lucide-react';
import { type FC, useEffect, useMemo } from 'react';
import { encodePlaygroundState } from '../../lib/playground/url-state';

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
  // Build playground URL - let the playground page handle example loading
  const playgroundURL = useMemo(() => {
    // If exampleId is provided, use query parameter (playground will load it)
    if (exampleId) {
      const params = new URLSearchParams();
      params.set('example', exampleId);
      if (query) {
        params.set('query', btoa(query));
      }
      return `/playground?${params.toString()}`;
    }

    // If custom code is provided, use hash-based state
    if (code) {
      const state = encodePlaygroundState({
        files: [
          {
            filename: 'schema.ts',
            content: code,
          },
        ],
        query,
        viewMode: query ? 'graphql' : 'code',
      });
      return `/playground#${state}`;
    }

    // Default to empty playground
    return '/playground';
  }, [exampleId, code, query]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
        role="dialog"
        aria-modal="true"
        className="relative h-full w-full md:h-[90vh] md:w-[90vw] md:rounded-lg bg-fd-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
      </div>
    </div>
  );
};
