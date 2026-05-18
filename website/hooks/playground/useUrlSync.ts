'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Operation } from '@/components/playground/OperationPane/types';
import type { PlaygroundFile } from '@/components/playground/types';
import { getPlaygroundStateFromURL, setPlaygroundStateToURL } from '@/lib/playground/url-state';
import { makeOperation, parseOperationName } from './useOperations';

export interface UrlInitialState {
  files: PlaygroundFile[];
  operations: Operation[];
  activeFileIndex?: number;
  step?: number;
}

/**
 * Read the playground state from `window.location.hash`. Returns null
 * when the URL has nothing useful — including during SSR. This must be
 * called from a client effect (not from `useState` init) so the server
 * and client agree on the first render.
 */
export function readInitialFromURL(): UrlInitialState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const url = getPlaygroundStateFromURL();
  if (!url) {
    return null;
  }

  let operations: Operation[] | null = null;
  if (url.queries && url.queries.length > 0) {
    operations = url.queries.map((q, i) =>
      makeOperation({
        name: q.title ?? parseOperationName(q.query, `Operation-${i + 1}`),
        query: q.query,
        variables: q.variables ?? '',
        context: q.context ?? '',
      }),
    );
  } else if (url.query) {
    operations = [
      makeOperation({
        name: parseOperationName(url.query, 'Untitled'),
        query: url.query,
        variables: url.variables ?? '',
        context: url.context ?? '',
      }),
    ];
  }

  if (!url.files?.length && !operations) {
    return null;
  }

  return {
    files: url.files?.length ? url.files : [],
    operations: operations ?? [],
    activeFileIndex: url.activeFileIndex,
    step: url.step,
  };
}

/**
 * One-shot hash → state hydrator. Calls `apply(state)` once on mount
 * if the hash carries a payload. Pulling this out of useState init
 * means SSR renders the same default content the client renders before
 * the effect fires, so React doesn't fault on hydration.
 *
 * Returns a ref that flips to `true` after the hash has been applied.
 * Callers can read this synchronously (in their own effects) to skip
 * conflicting initialization paths (e.g. `?example=` auto-load).
 */
export function useUrlInit(apply: (initial: UrlInitialState) => void): {
  appliedRef: React.MutableRefObject<boolean>;
} {
  const ranRef = useRef(false);
  const appliedRef = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (ranRef.current) {
      return;
    }
    ranRef.current = true;
    const state = readInitialFromURL();
    if (state) {
      appliedRef.current = true;
      applyRef.current(state);
    }
  }, []);

  return { appliedRef };
}

const URL_WRITE_DEBOUNCE_MS = 250;

/**
 * Stable content snapshot — files (full content) + operations
 * (name/query/variables/context). Selection state (which file or query
 * tab is active, which step is loaded) is intentionally excluded.
 *
 * Compared against the baseline below, this answers "has the user
 * edited anything yet?". Selecting a different query tab or file
 * doesn't change the answer.
 */
function contentSnapshotKey(files: PlaygroundFile[], operations: Operation[]): string {
  return JSON.stringify({
    files: files.map((f) => ({ filename: f.filename, content: f.content })),
    operations: operations.map((op) => ({
      name: op.name,
      query: op.query,
      variables: op.variables,
      context: op.context,
    })),
  });
}

interface UrlHashSyncArgs {
  files: PlaygroundFile[];
  operations: Operation[];
  activeOperationIndex: number;
  activeFileIndex: number;
  step?: number;
  /**
   * Snapshot of the unedited starting point. When an example is
   * loaded, this is the example's pristine content. Otherwise it's
   * the playground's defaults (so a `#code=…` link without an
   * `?example=` still diffs against defaults instead of itself).
   *
   * Set imperatively by `useExampleBaseline` — never inferred from
   * state transitions, which is what previously raced with React's
   * commit ordering and made selecting a query tab write a stale
   * hash.
   */
  baseline: string;
}

/**
 * Keep `window.location.hash` in sync with user edits.
 *
 * Behavior:
 *   - `baseline == null` → never write the hash. Manual / unloaded
 *     state stays clean (the search params still carry `?example=`).
 *   - Current content matches `baseline` → clear any stale hash. This
 *     also handles the "user reverted their edits manually" case.
 *   - Current content differs from `baseline` → write the hash
 *     (debounced) carrying files + operations + active selections.
 *
 * Selections (active tab, active file, step) don't influence the
 * "is this edited?" check — they ride along inside the hash payload
 * once the content has already diverged, but selecting a tab on an
 * unedited example never grows the URL.
 */
export function useUrlHashSync({
  files,
  operations,
  activeOperationIndex,
  activeFileIndex,
  step,
  baseline,
}: UrlHashSyncArgs): void {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = contentSnapshotKey(files, operations);
    if (current === baseline) {
      // Unedited — make sure no stale hash is left over from a prior
      // round of edits. Cheap when the hash is already empty.
      clearUrlHashIfPresent();
      return;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setPlaygroundStateToURL({
        files,
        query: operations[activeOperationIndex]?.query,
        variables: operations[activeOperationIndex]?.variables || undefined,
        context: operations[activeOperationIndex]?.context || undefined,
        queries:
          operations.length > 1
            ? operations.map((op) => ({
                title: op.name,
                query: op.query,
                variables: op.variables || undefined,
                context: op.context || undefined,
              }))
            : undefined,
        activeFileIndex,
        step,
        viewMode: 'graphql',
      });
    }, URL_WRITE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [files, operations, activeOperationIndex, activeFileIndex, step, baseline]);
}

function clearUrlHashIfPresent(): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!window.location.hash) {
    return;
  }
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', url.toString());
}

/**
 * The "unedited starting point" against which hash writes are diffed.
 * It's ALWAYS set to *something* — when no example is loaded, the
 * baseline is the playground's default files+operations, so a shared
 * `#code=…` link (without `?example=`) still diffs against defaults
 * and keeps its hash on reload.
 *
 * - `captureFromExample(files, operations)` — upgrade the baseline
 *   when the example loader hands back a bundle. Subsequent edits
 *   diff against the example's pristine content.
 * - `resetToDefaults()` — revert to the defaults snapshot (used when
 *   the user exits the example).
 *
 * The baseline lives in React state (not a ref) so `useUrlHashSync`
 * re-evaluates the moment it changes.
 */
export function useExampleBaseline(
  defaultFiles: () => PlaygroundFile[],
  defaultOperations: () => Operation[],
): {
  baseline: string;
  captureFromExample: (files: PlaygroundFile[], operations: Operation[]) => void;
  resetToDefaults: () => void;
} {
  const defaultsRef = useRef<string | null>(null);
  if (defaultsRef.current === null) {
    defaultsRef.current = contentSnapshotKey(defaultFiles(), defaultOperations());
  }
  const [baseline, setBaseline] = useState<string>(defaultsRef.current);
  const captureFromExample = useCallback((files: PlaygroundFile[], operations: Operation[]) => {
    setBaseline(contentSnapshotKey(files, operations));
  }, []);
  const resetToDefaults = useCallback(() => {
    if (defaultsRef.current !== null) {
      setBaseline(defaultsRef.current);
    }
  }, []);
  return { baseline, captureFromExample, resetToDefaults };
}
