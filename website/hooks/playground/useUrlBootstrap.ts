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
  /** 1-indexed in the URL; converted to 0-indexed inside the hook. */
  op: number | null;
} {
  if (typeof window === 'undefined') {
    return { embed: false, exampleId: null, query: null, step: null, op: null };
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
  // `step` may live in the URL hash (legacy) or as a `?step=N` search
  // param (current — written by setExampleInUrl when the user navigates
  // via the StepperBar). Search wins because that's where new links
  // come from; the hash check stays for back-compat with older
  // shared URLs.
  let step: number | null = null;
  const searchStep = params.get('step');
  if (searchStep) {
    const parsed = Number.parseInt(searchStep, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      step = parsed;
    }
  }
  if (step === null) {
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
  }
  let op: number | null = null;
  const searchOp = params.get('op');
  if (searchOp) {
    const parsed = Number.parseInt(searchOp, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      op = parsed;
    }
  }
  return { embed: params.get('embed') === '1', exampleId, query, step, op };
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
  /**
   * Lock in a content baseline so subsequent edits can diff against
   * "the state the user arrived at". Called from the hash-hydration
   * path (so a shared `#code=…` link uses the hash content as
   * baseline) — the example-load path inside `applyExampleResult`
   * already does its own baseline capture.
   */
  captureBaseline: (files: PlaygroundFile[], operations: Operation[]) => void;
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
  captureBaseline,
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
  // Pending hash-applied content. When `?example=foo` is ALSO present
  // (shared link with both example + edits), the search-params effect
  // below loads the example bundle just to extract its pristine
  // baseline — without overwriting the user-facing state, which
  // already has the edited hash content. Baseline = example pristine
  // means subsequent renders correctly diff hash content against the
  // example, keeping the URL hash present until the user reverts.
  const pendingHashContentRef = useRef<{ files: PlaygroundFile[]; operations: Operation[] } | null>(
    null,
  );

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
    // Don't touch the baseline here. The baseline already defaults
    // to the playground's defaults snapshot; if the hash carries
    // something different (the usual case for a shared link), the
    // diff is real and `useUrlHashSync` keeps the hash present.
    // The search-params effect below upgrades the baseline to the
    // example's pristine content when `?example=` is also set, so a
    // combined link diffs against the actual starting point.
    pendingHashContentRef.current = {
      files: initial.files,
      operations: initial.operations,
    };
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
    // `?op=2` selects the second operation tab after loading. Applied
    // after the example/hash bootstrap so it sticks (the example load
    // resets the active index to 0 inside applyExampleResult).
    const applyOpFromUrl = () => {
      if (search.op !== null) {
        opsState.setActiveIndex(search.op - 1);
      }
    };

    if (search.exampleId) {
      // Prefer step from the URL hash (set by `readSearchParamsOnce`)
      // over `pendingStepRef`; both are equivalent in practice but the
      // ref path also covers cases where the hash had files+step set.
      // `search.step` is 1-indexed (as written by setExampleInUrl);
      // convert to the 0-indexed value `goToStep` expects.
      const stepOneIndexed = search.step ?? pendingStepRef.current ?? null;
      pendingStepRef.current = null;
      const targetStepIndex =
        stepOneIndexed !== null && stepOneIndexed > 1 ? stepOneIndexed - 1 : 0;
      const hashContent = pendingHashContentRef.current;
      pendingHashContentRef.current = null;
      const hashApplied = urlHashApplied.current;
      exampleLoader
        .load(search.exampleId)
        .then(async (result) => {
          if (!result) {
            return;
          }
          // Resolve to the specific step's bundle first so the
          // baseline matches the step the user actually arrived at.
          let final = result;
          if (targetStepIndex > 0) {
            const stepResult = await exampleLoader.goToStep(targetStepIndex);
            if (stepResult) {
              final = stepResult;
            }
          }
          if (hashApplied && hashContent) {
            // Both `?example=` AND `#code=` are present. State is
            // already the edited hash content (applied by useUrlInit).
            // We loaded the example bundle ONLY to swap the baseline
            // from "hash content" over to "example pristine" — so the
            // hash sync correctly detects an edit and keeps the
            // `#code=…` in the URL on subsequent renders.
            captureBaseline(final.files, final.operations);
            applyOpFromUrl();
            return;
          }
          // No hash, or hash didn't carry files — apply the example
          // bundle normally. applyExampleResult does its own baseline
          // capture, so the URL stays at the short form until edited.
          applyExampleResult(final, search.query ?? undefined);
          applyOpFromUrl();
        })
        .catch((err) => {
          console.error('Failed to auto-load example from URL:', err);
        });
    } else if (search.op !== null) {
      // No example to load, but URL has `?op=`. Apply it directly to
      // whatever operations are loaded (defaults or hash-hydrated).
      applyOpFromUrl();
    }
  }, [exampleLoader, applyExampleResult, urlHashApplied, setSketchName, captureBaseline, opsState]);

  return { embed };
}
