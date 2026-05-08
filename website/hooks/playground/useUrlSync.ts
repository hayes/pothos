'use client';

import { useEffect, useRef, useState } from 'react';
import type { Operation } from '@/components/playground/OperationPane/types';
import type { PlaygroundFile } from '@/components/playground/types';
import { getPlaygroundStateFromURL, setPlaygroundStateToURL } from '@/lib/playground/url-state';
import { makeOperation, parseOperationName } from './useOperations';

interface SyncArgs {
  files: PlaygroundFile[];
  operations: Operation[];
  activeOperationIndex: number;
  activeFileIndex: number;
  step?: number;
  ready: boolean;
}

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

export function useUrlSync({
  files,
  operations,
  activeOperationIndex,
  activeFileIndex,
  step,
  ready,
}: SyncArgs): void {
  const [initialized, setInitialized] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (ready) {
      setInitialized(true);
    }
  }, [ready]);

  useEffect(() => {
    if (!initialized) {
      return;
    }
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
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
  }, [files, operations, activeOperationIndex, activeFileIndex, step, initialized]);
}
