'use client';

import { useCallback, useState } from 'react';
import {
  type ExampleMetadata,
  exampleMetadata,
  getExample,
  type Step,
} from '../../components/playground/examples';
import type { Operation } from '../../components/playground/OperationPane/types';
import type { PlaygroundFile } from '../../components/playground/types';
import { makeOperation } from './useOperations';

interface QueryShape {
  title?: string;
  query: string;
  variables?: string;
}

export interface LoadedExample {
  metadata: ExampleMetadata;
  steps: Step[];
}

export interface ExampleLoaderResult {
  files: PlaygroundFile[];
  operations: Operation[];
  defaultActive: number;
}

export interface ExampleLoaderState {
  loaded: LoadedExample | null;
  stepIndex: number;
  loading: boolean;
  load: (id: string) => Promise<ExampleLoaderResult | null>;
  setStepIndex: (index: number) => void;
  exit: () => void;
}

function operationsFromExample(
  defaultQuery: string,
  queries: readonly QueryShape[] | undefined,
): Operation[] {
  if (queries && queries.length > 0) {
    return queries.map((q, i) =>
      makeOperation({
        name: q.title ?? `Operation-${i + 1}`,
        query: q.query,
        variables: q.variables ?? '',
      }),
    );
  }
  return [makeOperation({ query: defaultQuery, variables: '' })];
}

export function useExampleLoader(): ExampleLoaderState {
  const [loaded, setLoaded] = useState<LoadedExample | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string): Promise<ExampleLoaderResult | null> => {
    setLoading(true);
    try {
      const ex = await getExample(id);
      if (!ex) {
        return null;
      }

      const meta =
        exampleMetadata.find((m) => m.id === ex.id) ??
        ({
          id: ex.id,
          title: ex.title,
          description: ex.description,
          tags: ex.tags ?? [],
          steps: ex.steps,
        } as ExampleMetadata);

      const steps = meta.steps ?? [];
      setLoaded({ metadata: meta, steps });
      setStepIndex(0);

      const operations = operationsFromExample(ex.defaultQuery, ex.queries);
      return { files: ex.files, operations, defaultActive: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const exit = useCallback(() => {
    setLoaded(null);
    setStepIndex(0);
  }, []);

  return { loaded, stepIndex, loading, load, setStepIndex, exit };
}
