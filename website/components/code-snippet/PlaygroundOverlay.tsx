'use client';

import { X } from 'lucide-react';
import { type FC, useEffect, useState } from 'react';
import { getExample } from '../playground/examples';
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
 * - Dynamically loads examples on-demand
 * - Full-screen on mobile, 90% width on desktop
 * - Escape key to close
 * - Click outside to close
 * - Loading state while playground initializes
 */
export const PlaygroundOverlay: FC<PlaygroundOverlayProps> = ({
  exampleId,
  code,
  query,
  onClose,
}) => {
  const [playgroundURL, setPlaygroundURL] = useState<string>('/playground');
  const [isLoading, setIsLoading] = useState(!!exampleId);

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

  // Build playground URL using the new hash-based format
  useEffect(() => {
    async function loadPlaygroundURL() {
      // If exampleId is provided, load the example from registry
      if (exampleId) {
        setIsLoading(true);
        const example = await getExample(exampleId);
        if (example) {
          const state = encodePlaygroundState({
            files: example.files,
            query: query || example.defaultQuery,
            viewMode: query ? 'graphql' : 'code',
          });
          setPlaygroundURL(`/playground#${state}`);
        } else {
          setPlaygroundURL('/playground');
        }
        setIsLoading(false);
        return;
      }

      // If custom code is provided, create a single file
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
        setPlaygroundURL(`/playground#${state}`);
        return;
      }

      // Default to empty playground
      setPlaygroundURL('/playground');
    }

    loadPlaygroundURL();
  }, [exampleId, code, query]);

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

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-fd-background/80 backdrop-blur-sm md:rounded-lg">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-fd-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
              <p className="mt-4 text-sm text-fd-muted-foreground">Loading example...</p>
            </div>
          </div>
        )}

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
