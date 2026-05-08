'use client';

import { useEffect, useRef, useState } from 'react';
import type { Operation } from '@/components/playground/OperationPane/types';
import type { PlaygroundFile } from '@/components/playground/types';
import type { ExampleLoaderState } from './useExampleLoader';
import type { OperationsState } from './useOperations';
import type { PlaygroundFilesState } from './usePlaygroundFiles';
import { useUrlInit } from './useUrlSync';

/**
 * Read `?embed`, `?example`, `?query` from window.location once on
 * mount. Doing this in an effect (not in component init) keeps SSR
 * and the first client paint identical so React doesn't fault.
 *
 * `step` is also read out of `window.location.hash` here so the
 * search-params effect can apply it on top of an `?example=` auto-load
 * even when the hash has nothing else to hydrate (i.e. when
 * `useUrlInit` returns no payload).
 */
function readSearchParamsOnce(): {
  embed: boolean;
  exampleId: string | null;
  query: string | null;
  step: number | null;
} {
  if (typeof window === 'undefined') {
    return { embed: false, exampleId: null, query: null, step: null };
  }
  const params = new URLSearchParams(window.location.search);
  const exampleId = params.get('example');
  const queryRaw = params.get('query');
  let query: string | null = null;
  if (queryRaw) {
    try {
      query = atob(queryRaw);
    } catch {
      query = queryRaw;
    }
  }
  let step: number | null = null;
  const hash = window.location.hash.slice(1);
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    const raw = hashParams.get('step');
    if (raw) {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        step = parsed;
      }
    }
  }
  return { embed: params.get('embed') === '1', exampleId, query, step };
}

interface ApplyExampleResultInput {
  files: PlaygroundFile[];
  operations: Operation[];
}

interface UseUrlBootstrapArgs {
  filesState: PlaygroundFilesState;
  opsState: OperationsState;
  exampleLoader: ExampleLoaderState;
  /**
   * Push an example's `{files, operations}` into the playground state.
   * `queryOverride` (when present) replaces the first operation's
   * `query` before applying — used by `?example=…&query=…` URLs.
   */
  applyExampleResult: (result: ApplyExampleResultInput, queryOverride?: string) => void;
  /**
   * The page's local sketch-name setter. We need it because `?embed=1`
   * clears the placeholder so the toolbar doesn't show "untitled
   * sketch" inside an iframe before the example title mirrors in.
   */
  setSketchName: (next: string) => void;
}

interface UseUrlBootstrapResult {
  embed: boolean;
}

/**
 * One-time URL bootstrap on mount: hash hydration via `useUrlInit`,
 * then `?embed`, `?example`, `?query` and the `step=` part of the hash.
 *
 * Doing this here (vs. useState init) keeps SSR's first paint matching
 * the client's first paint, so React doesn't fault on hydration. The
 * hook runs entirely in effects after mount.
 *
 * Precedence rules (preserved from the original page implementation):
 * - If `useUrlInit` already hydrated state from `#code=…`, the hash
 *   wins: it represents the user's edited state, so we skip the
 *   example load entirely (but still honor `?embed=1`).
 * - `step` from the URL hash takes priority over `pendingStepRef`;
 *   both are equivalent in practice but the ref path also covers
 *   cases where the hash carried both files and a step.
 */
export function useUrlBootstrap({
  filesState,
  opsState,
  exampleLoader,
  applyExampleResult,
  setSketchName,
}: UseUrlBootstrapArgs): UseUrlBootstrapResult {
  // Read URL search params (?embed, ?example, ?query) once after mount.
  const [embed, setEmbed] = useState(false);
  const searchInitRef = useRef(false);

  // Pending step to apply once an example finishes loading. Set by the
  // hash-state hydrator below if the hash carries a `step=` value.
  const pendingStepRef = useRef<number | null>(null);

  // Hydrate from `window.location.hash` once after mount. Doing this
  // here (rather than in useState init) keeps the server's first paint
  // matching the client's first paint, so React doesn't fault.
  // The returned `appliedRef` tells the search-params effect below
  // to skip auto-loading `?example=` when the hash already restored
  // user-edited state (hash wins over the example link).
  const { appliedRef: urlHashApplied } = useUrlInit((initial) => {
    if (initial.files.length > 0) {
      filesState.setFiles(initial.files);
      filesState.setActiveIndex(initial.activeFileIndex ?? 0);
    }
    if (initial.operations.length > 0) {
      opsState.setOperations(initial.operations);
      opsState.setActiveIndex(0);
      opsState.markClean();
    }
    if (typeof initial.step === 'number') {
      pendingStepRef.current = initial.step;
    }
  });

  // One-shot reader for `?embed`, `?example`, and `?query` URL params.
  // Runs in an effect (not useState init) so SSR and the first client
  // paint stay identical — `useUrlInit` does the same for hash state.
  //
  // If `useUrlInit` already applied state from `#code=…`, the hash wins:
  // it represents the user's edited state, so we skip the example load
  // entirely (but still honor `?embed=1`).
  useEffect(() => {
    if (searchInitRef.current) {
      return;
    }
    searchInitRef.current = true;
    const search = readSearchParamsOnce();
    if (search.embed) {
      setEmbed(true);
      // Clear the standalone-mode placeholder so the toolbar renders
      // nothing until the example load below mirrors a real title in.
      setSketchName('');
    }
    if (search.exampleId && !urlHashApplied.current) {
      // Prefer step from the URL hash (set by `readSearchParamsOnce`)
      // over `pendingStepRef`; both are equivalent in practice but the
      // ref path also covers cases where the hash had files+step set.
      const step = search.step ?? pendingStepRef.current ?? null;
      pendingStepRef.current = null;
      exampleLoader
        .load(search.exampleId)
        .then((result) => {
          if (!result) {
            return;
          }
          applyExampleResult(result, search.query ?? undefined);
          if (step !== null && step > 0) {
            return exampleLoader.goToStep(step).then((stepResult) => {
              if (stepResult) {
                applyExampleResult(stepResult, search.query ?? undefined);
              }
            });
          }
          return undefined;
        })
        .catch((err) => {
          console.error('Failed to auto-load example from URL:', err);
        });
    }
  }, [exampleLoader, applyExampleResult, urlHashApplied, setSketchName]);

  return { embed };
}
