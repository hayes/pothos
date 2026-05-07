'use client';

import { useEffect, useRef, useState } from 'react';
import type { Operation } from '../../components/playground/OperationPane/types';
import type { PlaygroundFile } from '../../components/playground/types';
import { getPlaygroundStateFromURL, setPlaygroundStateToURL } from '../../lib/playground/url-state';
import { makeOperation, parseOperationName } from './useOperations';

interface SyncArgs {
  files: PlaygroundFile[];
  operations: Operation[];
  activeOperationIndex: number;
  ready: boolean;
}

export interface UrlInitialState {
  files: PlaygroundFile[];
  operations: Operation[];
}

/**
 * Read the playground state from `window.location.hash`. Returns null
 * when the URL has nothing useful — including during SSR. This must be
 * called from a client effect (not from `useState` init) so the server
 * and client agree on the first render.
 */
export function readInitialFromURL(): UrlInitialState | null {
  if (typeof window === 'undefined') return null;
  const url = getPlaygroundStateFromURL();
  if (!url) return null;

  let operations: Operation[] | null = null;
  if (url.queries && url.queries.length > 0) {
    operations = url.queries.map((q, i) =>
      makeOperation({
        name: q.title ?? parseOperationName(q.query, `Operation-${i + 1}`),
        query: q.query,
        variables: q.variables ?? '',
      }),
    );
  } else if (url.query) {
    operations = [
      makeOperation({
        name: parseOperationName(url.query, 'Untitled'),
        query: url.query,
        variables: url.variables ?? '',
      }),
    ];
  }

  if (!url.files?.length && !operations) return null;

  return {
    files: url.files?.length ? url.files : [],
    operations: operations ?? [],
  };
}

/**
 * One-shot hash → state hydrator. Calls `apply(state)` once on mount
 * if the hash carries a payload. Pulling this out of useState init
 * means SSR renders the same default content the client renders before
 * the effect fires, so React doesn't fault on hydration.
 */
export function useUrlInit(apply: (initial: UrlInitialState) => void): void {
  const ranRef = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const state = readInitialFromURL();
    if (state) applyRef.current(state);
  }, []);
}

export function useUrlSync({ files, operations, activeOperationIndex, ready }: SyncArgs): void {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (ready) {
      setInitialized(true);
    }
  }, [ready]);

  useEffect(() => {
    if (!initialized) {
      return;
    }
    setPlaygroundStateToURL({
      files,
      query: operations[activeOperationIndex]?.query,
      variables: operations[activeOperationIndex]?.variables || undefined,
      queries:
        operations.length > 1
          ? operations.map((op) => ({
              title: op.name,
              query: op.query,
              variables: op.variables || undefined,
            }))
          : undefined,
      activeFileIndex: 0,
      viewMode: 'graphql',
    });
  }, [files, operations, activeOperationIndex, initialized]);
}
