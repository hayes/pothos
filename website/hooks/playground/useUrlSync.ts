'use client';

import { useEffect, useState } from 'react';
import type { Operation } from '../../components/playground/OperationPane/types';
import type { PlaygroundFile } from '../../components/playground/types';
import { getPlaygroundStateFromURL, setPlaygroundStateToURL } from '../../lib/playground/url-state';
import { makeOperation, parseOperationName } from './useOperations';

interface InitialState {
  files: PlaygroundFile[];
  operations: Operation[];
  activeOperationIndex: number;
}

interface SyncArgs {
  files: PlaygroundFile[];
  operations: Operation[];
  activeOperationIndex: number;
  ready: boolean;
}

export function readInitialFromURL(fallback: InitialState): InitialState {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const url = getPlaygroundStateFromURL();
  if (!url) {
    return fallback;
  }

  const files = url.files?.length ? url.files : fallback.files;

  let operations: Operation[] = fallback.operations;
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

  return {
    files,
    operations,
    activeOperationIndex: 0,
  };
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
